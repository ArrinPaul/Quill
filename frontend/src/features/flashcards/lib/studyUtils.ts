export type StudyMode = "all" | "due";

export interface FlashcardItem {
  id: string | number;
  front: string;
  back: string;
  citation?: string | null;
  status?: "mastered" | "review" | "unseen";
  interval_days?: number;
  next_review_at?: string | null;
}

export interface DeckItem {
  id: string;
  title: string;
  created_at: string;
  flashcards: FlashcardItem[];
}

export interface SavedDeckPosition {
  cardId: string | number;
  mode: StudyMode;
}

/**
 * A card is due if it has never been scheduled (next_review_at is null/missing)
 * or its scheduled next_review_at is at or before `now`.
 */
export function isCardDue(
  card: Pick<FlashcardItem, "next_review_at">,
  now: Date = new Date()
): boolean {
  if (!card.next_review_at) return true;
  const reviewMs = Date.parse(card.next_review_at);
  if (Number.isNaN(reviewMs)) return true;
  return reviewMs <= now.getTime();
}

/** Filter cards to only those currently due for review. */
export function getDueCards<T extends Pick<FlashcardItem, "next_review_at">>(
  cards: T[],
  now: Date = new Date()
): T[] {
  return cards.filter((card) => isCardDue(card, now));
}

/** Return the earliest upcoming review Date strictly after `now`, or null if none. */
export function getNextDueDate(
  cards: Array<Pick<FlashcardItem, "next_review_at">>,
  now: Date = new Date()
): Date | null {
  const nowMs = now.getTime();
  let earliestMs: number | null = null;

  for (const card of cards) {
    if (!card.next_review_at) continue;
    const ms = Date.parse(card.next_review_at);
    if (Number.isNaN(ms) || ms <= nowMs) continue;
    if (earliestMs === null || ms < earliestMs) {
      earliestMs = ms;
    }
  }

  return earliestMs === null ? null : new Date(earliestMs);
}

/** localStorage key for persisting study position of a deck. */
export function deckPositionKey(deckId: string): string {
  return `Quill_deck_${deckId}`;
}

/** Parse and validate a serialized SavedDeckPosition from localStorage. */
export function parseSavedPosition(raw: string | null): SavedDeckPosition | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    const { cardId, mode } = record;
    if (typeof cardId !== "string" && typeof cardId !== "number") return null;
    if (mode !== "all" && mode !== "due") return null;
    return { cardId, mode };
  } catch {
    return null;
  }
}

/**
 * Resolve which cards, mode, and index to show when restoring a deck's saved position.
 * Gracefully falls back to mode "all" at index 0 if the saved card no longer exists
 * or no due cards remain.
 */
export function resolveRestoredPosition<T extends Pick<FlashcardItem, "id" | "next_review_at">>(
  cards: T[],
  saved: SavedDeckPosition | null,
  now: Date = new Date()
): { mode: StudyMode; cards: T[]; index: number } {
  if (!saved || cards.length === 0) {
    return { mode: "all", cards, index: 0 };
  }

  const targetCards = saved.mode === "due" ? getDueCards(cards, now) : cards;
  if (targetCards.length === 0) {
    return { mode: "all", cards, index: 0 };
  }

  const idx = targetCards.findIndex((c) => String(c.id) === String(saved.cardId));
  if (idx === -1) {
    return { mode: "all", cards, index: 0 };
  }

  return { mode: saved.mode, cards: targetCards, index: idx };
}

/**
 * Escape a single CSV cell:
 * - Prefix cells starting with =, +, -, or @ with a leading apostrophe to prevent formula injection.
 * - Quote cells containing commas, double quotes, or newlines per RFC 4180.
 */
export function escapeCsvCell(value: string | null | undefined): string {
  const str = value == null ? "" : String(value);
  const formulaSafe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  if (/[",\r\n]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }
  return formulaSafe;
}

/** Serialize a list of flashcards into a safe CSV string with header row. */
export function deckToCsv(
  cards: Array<Pick<FlashcardItem, "front" | "back" | "citation" | "status">>
): string {
  const header = ["Front", "Back", "Citation", "Status"].join(",");
  const rows = cards.map((card) =>
    [
      escapeCsvCell(card.front),
      escapeCsvCell(card.back),
      escapeCsvCell(card.citation ?? ""),
      escapeCsvCell(card.status ?? "unseen"),
    ].join(",")
  );
  return [header, ...rows].join("\r\n");
}
