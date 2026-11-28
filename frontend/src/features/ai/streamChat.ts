import { API_BASE } from "@/lib/api";

export interface StreamCallbacks {
  onDelta: (delta: string) => void;
  signal?: AbortSignal;
}

interface SsePayload {
  delta?: string;
  done?: boolean;
  messageId?: string;
  error?: string;
}

export async function streamConversationMessage(
  conversationId: string,
  content: string,
  { onDelta, signal }: StreamCallbacks
): Promise<{ messageId?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };

  if (typeof window !== "undefined") {
    const storedToken = localStorage.getItem("Quill_token");
    if (storedToken) {
      headers["Authorization"] = `Bearer ${storedToken}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/ai/conversations/${conversationId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    throw new Error("Network error — please check your connection and try again.");
  }

  if (!res.ok) {
    if (res.status === 401 && headers["Authorization"] && typeof window !== "undefined") {
      localStorage.removeItem("Quill_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    const fallback =
      res.status === 429
        ? "Daily AI limit reached. Please try again tomorrow."
        : `Request failed with status ${res.status}`;
    const errBody = await res.json().catch(() => ({ message: fallback }));
    throw new Error(errBody.message || fallback);
  }

  if (!res.body) {
    throw new Error("Streaming is not supported by this browser.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let messageId: string | undefined;

  const processBlock = (block: string) => {
    const dataLines = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());

    if (dataLines.length === 0) return;

    const payload = JSON.parse(dataLines.join("\n")) as SsePayload;
    if (payload.error) {
      throw new Error(payload.error);
    }
    if (typeof payload.delta === "string" && payload.delta.length > 0) {
      onDelta(payload.delta);
    }
    if (payload.done) {
      messageId = payload.messageId;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (part.trim()) {
        processBlock(part);
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    processBlock(buffer);
  }

  return { messageId };
}
