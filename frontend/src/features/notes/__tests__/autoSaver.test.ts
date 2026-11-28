import { describe, expect, it } from "vitest";
import { createNoteSaver, type SaveRequest, type SaveResult } from "../lib/autoSaver";

function setup(version = 1) {
  const sent: SaveRequest[] = [];
  const saver = createNoteSaver(
    { title: "A", content: "one", version },
    async (request) => {
      sent.push(request);
      await new Promise((r) => setTimeout(r, 5));
      return request.version + 1;
    },
    () => {}
  );
  return { saver, sent };
}

describe("createNoteSaver", () => {
  it("sends nothing when the note was only opened", async () => {
    const { saver, sent } = setup();
    saver.update({ title: "A", content: "one" });
    await saver.flush();
    expect(sent).toHaveLength(0);
  });

  it("queues a second save behind the first and uses the new version", async () => {
    const { saver, sent } = setup();
    saver.update({ title: "A", content: "two" });
    const first = saver.save();
    await Promise.resolve();
    saver.update({ title: "A", content: "three" });
    await Promise.all([first, saver.save()]);
    expect(sent.map((s) => [s.content, s.version])).toEqual([["two", 1], ["three", 2]]);
  });

  it("keeps versions apart between two notes", async () => {
    const a = setup(7);
    const b = setup(2);
    a.saver.update({ title: "A", content: "changed" });
    b.saver.update({ title: "B", content: "changed" });
    await Promise.all([a.saver.flush(), b.saver.flush()]);
    expect([a.sent[0].version, b.sent[0].version]).toEqual([7, 2]);
  });

  it("reports a conflict and sends nothing after discard", async () => {
    const results: SaveResult[] = [];
    let calls = 0;
    const saver = createNoteSaver(
      { title: "A", content: "one", version: 1 },
      async () => {
        calls += 1;
        throw new Error("Conflict: Note was updated elsewhere.");
      },
      (r) => results.push(r)
    );
    saver.update({ title: "A", content: "two" });
    await saver.flush();
    expect(results.at(-1)).toBe("conflict");
    saver.discard();
    await saver.flush();
    expect(calls).toBe(1);
  });
});
