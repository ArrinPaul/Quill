import { describe, it, expect, vi, afterEach } from "vitest";
import { streamConversationMessage } from "../streamChat";

function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe("streamConversationMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses chunked SSE delta and done events", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        makeSseStream([
          'data: {"delta":"Hel',
          'lo "}\n\ndata: {"delta":"world"}\n\n',
          'data: {"done":true,"messageId":"msg-123"}\n\n',
        ]),
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      )
    );

    const deltas: string[] = [];
    const result = await streamConversationMessage("conv-1", "Hi", {
      onDelta: (d) => deltas.push(d),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(deltas.join("")).toBe("Hello world");
    expect(result.messageId).toBe("msg-123");
  });

  it("throws when SSE emits an error event", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        makeSseStream(['data: {"error":"AI unavailable"}\n\n']),
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      )
    );

    await expect(
      streamConversationMessage("conv-1", "Hi", { onDelta: () => {} })
    ).rejects.toThrow("AI unavailable");
  });
});
