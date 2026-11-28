/**
 * Autosave state for ONE open note. Each note gets its own saver, so a save that
 * finishes late can never touch the version or text of the note opened after it.
 */
export interface NoteDraft {
  title: string;
  content: string;
}

export type SaveResult = "saving" | "saved" | "error" | "conflict";

export interface SaveRequest extends NoteDraft {
  version: number;
  force: boolean;
  keepalive: boolean;
}

export function createNoteSaver(
  initial: NoteDraft & { version: number },
  send: (request: SaveRequest) => Promise<number>,
  report: (result: SaveResult) => void
) {
  let version = initial.version;
  let saved: NoteDraft = { title: initial.title, content: initial.content };
  let draft: NoteDraft = saved;
  let discarded = false;
  let queue: Promise<void> = Promise.resolve();

  const isDirty = () => draft.title !== saved.title || draft.content !== saved.content;

  /** Saves run one after another, so each one sends the version the last one returned. */
  const save = ({ force = false, keepalive = false } = {}) => {
    queue = queue.then(async () => {
      if (discarded) return;
      if (!force && !isDirty()) {
        report("saved");
        return;
      }
      const sending = draft;
      report("saving");
      try {
        version = await send({ ...sending, version, force, keepalive });
        saved = sending;
        report("saved");
      } catch (err) {
        const conflict = err instanceof Error && err.message.startsWith("Conflict:");
        report(conflict ? "conflict" : "error");
      }
    });
    return queue;
  };

  return {
    update(next: NoteDraft) {
      draft = next;
    },
    isDirty,
    save,
    /** Save anything outstanding and resolve once the server has answered. */
    flush: (options: { keepalive?: boolean } = {}) => (isDirty() ? save(options) : queue),
    /** Drop unsaved text: the note was deleted, or the server copy is being reloaded. */
    discard() {
      discarded = true;
    },
  };
}

export type NoteSaver = ReturnType<typeof createNoteSaver>;
