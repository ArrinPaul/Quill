import { describe, expect, it } from "vitest";
import {
  deckPositionKey,
  deckToCsv,
  escapeCsvCell,
  getDueCards,
  getNextDueDate,
  isCardDue,
  parseSavedPosition,
  resolveRestoredPosition,
  type FlashcardItem,
} from "../lib/studyUtils";

describe("flashcards due filtering", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("treats null/missing next_review_at and past/equal dates as due", () => {
    expect(isCardDue({ next_review_at: null }, now)).toBe(true);
    expect(isCardDue({ next_review_at: undefined }, now)).toBe(true);
    expect(isCardDue({ next_review_at: "2026-06-01T12:00:00.000Z" }, now)).toBe(true);
    expect(isCardDue({ next_review_at: "2026-05-31T23:59:59.000Z" }, now)).toBe(true);
    expect(isCardDue({ next_review_at: "2026-06-01T12:00:01.000Z" }, now)).toBe(false);
  });

  it("filters due cards and finds the earliest next due date", () => {
    const cards: FlashcardItem[] = [
      { id: "1", front: "A", back: "1", next_review_at: "2026-06-02T10:00:00.000Z" },
      { id: "2", front: "B", back: "2", next_review_at: null },
      { id: "3", front: "C", back: "3", next_review_at: "2026-06-01T08:00:00.000Z" },
      { id: "4", front: "D", back: "4", next_review_at: "2026-06-01T18:00:00.000Z" },
    ];

    const due = getDueCards(cards, now);
    expect(due.map((c) => c.id)).toEqual(["2", "3"]);

    const nextDue = getNextDueDate(cards, now);
    expect(nextDue?.toISOString()).toBe("2026-06-01T18:00:00.000Z");

    expect(getNextDueDate([cards[1], cards[2]], now)).toBeNull();
  });
});

describe("flashcards position persistence", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");
  const cards: FlashcardItem[] = [
    { id: "c1", front: "Q1", back: "A1", next_review_at: "2026-06-05T00:00:00.000Z" },
    { id: "c2", front: "Q2", back: "A2", next_review_at: null },
    { id: "c3", front: "Q3", back: "A3", next_review_at: "2026-06-01T09:00:00.000Z" },
  ];

  it("builds Quill_deck_<id> key and parses valid positions", () => {
    expect(deckPositionKey("abc-123")).toBe("Quill_deck_abc-123");
    expect(parseSavedPosition('{"cardId":"c2","mode":"due"}')).toEqual({
      cardId: "c2",
      mode: "due",
    });
    expect(parseSavedPosition("not-json")).toBeNull();
    expect(parseSavedPosition('{"cardId":"c2","mode":"invalid"}')).toBeNull();
  });

  it("restores saved card in all or due mode and ignores missing cards gracefully", () => {
    const restoredAll = resolveRestoredPosition(cards, { cardId: "c2", mode: "all" }, now);
    expect(restoredAll.mode).toBe("all");
    expect(restoredAll.cards).toHaveLength(3);
    expect(restoredAll.index).toBe(1);

    const restoredDue = resolveRestoredPosition(cards, { cardId: "c3", mode: "due" }, now);
    expect(restoredDue.mode).toBe("due");
    expect(restoredDue.cards.map((c) => c.id)).toEqual(["c2", "c3"]);
    expect(restoredDue.index).toBe(1);

    const missingCard = resolveRestoredPosition(cards, { cardId: "deleted-id", mode: "due" }, now);
    expect(missingCard.mode).toBe("all");
    expect(missingCard.cards).toHaveLength(3);
    expect(missingCard.index).toBe(0);
  });
});

describe("flashcards CSV escaping and export", () => {
  it("neutralizes formula prefixes =, +, -, @ and quotes special characters", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell("+1234")).toBe("'+1234");
    expect(escapeCsvCell("-cmd|' /C calc'!A0")).toBe("'-cmd|' /C calc'!A0");
    expect(escapeCsvCell("@SUM(1,2)")).toBe("\"'@SUM(1,2)\"");
    expect(escapeCsvCell('Hello, "world"')).toBe('"Hello, ""world"""');
    expect(escapeCsvCell("Line1\nLine2")).toBe('"Line1\nLine2"');
    expect(escapeCsvCell(null)).toBe("");
  });

  it("serializes deck cards with header and escaped rows", () => {
    const csv = deckToCsv([
      { front: "=1+1", back: 'Two, "2"', citation: "Note 1", status: "mastered" },
    ]);
    expect(csv).toBe('Front,Back,Citation,Status\r\n\'=1+1,"Two, ""2""",Note 1,mastered');
  });
});
