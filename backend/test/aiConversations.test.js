const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");
const {
  setGroqClient,
  setStreamCompleter,
  setAiTimeoutMs,
} = require("../src/services/groq");

function parseSseEvents(raw) {
  return raw
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const dataLines = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      if (dataLines.length === 0) return null;
      return JSON.parse(dataLines.join("\n"));
    })
    .filter(Boolean);
}

describe("E8 Saved AI chat conversations & SSE streaming", () => {
  let ctx;
  let userA;
  let userB;
  let prevDailyLimit;

  before(async () => {
    prevDailyLimit = process.env.AI_DAILY_LIMIT;
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();
  });

  afterEach(() => {
    setStreamCompleter(null);
    setGroqClient(null);
    setAiTimeoutMs(null);
    if (prevDailyLimit === undefined) {
      delete process.env.AI_DAILY_LIMIT;
    } else {
      process.env.AI_DAILY_LIMIT = prevDailyLimit;
    }
  });

  after(async () => {
    await ctx.close();
  });

  it("rejects unauthenticated requests with 401 across all conversation endpoints", async () => {
    const fakeId = "00000000-0000-4000-8000-000000000001";
    const checks = [
      ["GET", "/api/ai/conversations"],
      ["POST", "/api/ai/conversations", { title: "Test" }],
      ["PATCH", `/api/ai/conversations/${fakeId}`, { title: "Renamed" }],
      ["DELETE", `/api/ai/conversations/${fakeId}`],
      ["GET", `/api/ai/conversations/${fakeId}/messages`],
      ["POST", `/api/ai/conversations/${fakeId}/messages`, { content: "Hello" }],
    ];

    for (const [method, path, body] of checks) {
      const res = await ctx.request(method, path, { body });
      assert.equal(res.status, 401, `Expected 401 for ${method} ${path}`);
    }
  });

  it("enforces ownership (404 for another user) on GET messages, PATCH, DELETE, and POST messages", async () => {
    const created = await ctx.request("POST", "/api/ai/conversations", {
      token: userA.token,
      body: { title: "Algorithms Study" },
    });
    assert.equal(created.status, 201);
    const convId = created.data.conversation.id;
    assert.equal(created.data.conversation.title, "Algorithms Study");

    const getOther = await ctx.request("GET", `/api/ai/conversations/${convId}/messages`, {
      token: userB.token,
    });
    assert.equal(getOther.status, 404);

    const patchOther = await ctx.request("PATCH", `/api/ai/conversations/${convId}`, {
      token: userB.token,
      body: { title: "Hijacked" },
    });
    assert.equal(patchOther.status, 404);

    const postOther = await ctx.request("POST", `/api/ai/conversations/${convId}/messages`, {
      token: userB.token,
      body: { content: "Can I read this?" },
    });
    assert.equal(postOther.status, 404);

    const deleteOther = await ctx.request("DELETE", `/api/ai/conversations/${convId}`, {
      token: userB.token,
    });
    assert.equal(deleteOther.status, 404);

    // Owner can rename and delete
    const patchOwner = await ctx.request("PATCH", `/api/ai/conversations/${convId}`, {
      token: userA.token,
      body: { title: "Algorithms Final" },
    });
    assert.equal(patchOwner.status, 200);
    assert.equal(patchOwner.data.conversation.title, "Algorithms Final");

    const deleteOwner = await ctx.request("DELETE", `/api/ai/conversations/${convId}`, {
      token: userA.token,
    });
    assert.equal(deleteOwner.status, 200);

    const afterDelete = await ctx.request("GET", `/api/ai/conversations/${convId}/messages`, {
      token: userA.token,
    });
    assert.equal(afterDelete.status, 404);
  });

  it("lists conversations ordered by updated_at desc and streams SSE replies saving assistant message on success", async () => {
    const c1 = await ctx.request("POST", "/api/ai/conversations", {
      token: userA.token,
      body: { title: "First Chat" },
    });
    await new Promise((r) => setTimeout(r, 15));
    const c2 = await ctx.request("POST", "/api/ai/conversations", {
      token: userA.token,
      body: { title: "Second Chat" },
    });

    const list1 = await ctx.request("GET", "/api/ai/conversations", { token: userA.token });
    assert.equal(list1.status, 200);
    assert.equal(list1.data.conversations[0].id, c2.data.conversation.id);
    assert.equal(list1.data.conversations[1].id, c1.data.conversation.id);

    let capturedMessages = null;
    setStreamCompleter(async (params, { onDelta }) => {
      capturedMessages = params.messages;
      onDelta("Hello ");
      onDelta("from Uki!");
    });

    const sseRes = await ctx.request("POST", `/api/ai/conversations/${c1.data.conversation.id}/messages`, {
      token: userA.token,
      body: { content: "Explain BFS vs DFS" },
    });
    assert.equal(sseRes.status, 200);
    assert.match(sseRes.headers.get("content-type") || "", /text\/event-stream/);

    const events = parseSseEvents(sseRes.text);
    assert.deepEqual(
      events.filter((e) => "delta" in e).map((e) => e.delta),
      ["Hello ", "from Uki!"]
    );
    const doneEvent = events.find((e) => e.done === true);
    assert.ok(doneEvent?.messageId, "Expected done event with messageId");

    // Verify server prepended system prompt and included user message
    assert.equal(capturedMessages[0].role, "system");
    assert.equal(capturedMessages[capturedMessages.length - 1].role, "user");
    assert.equal(capturedMessages[capturedMessages.length - 1].content, "Explain BFS vs DFS");

    // Verify both messages were persisted
    const msgsRes = await ctx.request("GET", `/api/ai/conversations/${c1.data.conversation.id}/messages`, {
      token: userA.token,
    });
    assert.equal(msgsRes.status, 200);
    assert.equal(msgsRes.data.messages.length, 2);
    assert.equal(msgsRes.data.messages[0].role, "user");
    assert.equal(msgsRes.data.messages[0].content, "Explain BFS vs DFS");
    assert.equal(msgsRes.data.messages[1].role, "assistant");
    assert.equal(msgsRes.data.messages[1].content, "Hello from Uki!");
    assert.equal(msgsRes.data.messages[1].id, doneEvent.messageId);

    // c1 now has newer updated_at, so it should be first in the list
    const list2 = await ctx.request("GET", "/api/ai/conversations", { token: userA.token });
    assert.equal(list2.data.conversations[0].id, c1.data.conversation.id);
  });

  it("refunds quota and does NOT save assistant message when streaming fails", async () => {
    process.env.AI_DAILY_LIMIT = "1";
    const student = await ctx.registerStudent();

    const created = await ctx.request("POST", "/api/ai/conversations", {
      token: student.token,
      body: { title: "Failure Test" },
    });
    const convId = created.data.conversation.id;

    setStreamCompleter(async (_params, { onDelta }) => {
      onDelta("Partial...");
      throw new Error("Groq stream interrupted");
    });

    const failedSse = await ctx.request("POST", `/api/ai/conversations/${convId}/messages`, {
      token: student.token,
      body: { content: "Will this fail?" },
    });
    assert.equal(failedSse.status, 200);
    const events = parseSseEvents(failedSse.text);
    const errorEvent = events.find((e) => "error" in e);
    assert.ok(errorEvent?.error, "Expected SSE error event");
    assert.equal(events.some((e) => e.done), false);

    // Only user message should exist; assistant message must NOT be saved
    const msgsAfterFail = await ctx.request("GET", `/api/ai/conversations/${convId}/messages`, {
      token: student.token,
    });
    assert.equal(msgsAfterFail.status, 200);
    assert.equal(msgsAfterFail.data.messages.length, 1);
    assert.equal(msgsAfterFail.data.messages[0].role, "user");

    // Quota was refunded, so a retry with AI_DAILY_LIMIT=1 succeeds
    setStreamCompleter(async (_params, { onDelta }) => {
      onDelta("Recovered reply");
    });
    const retrySse = await ctx.request("POST", `/api/ai/conversations/${convId}/messages`, {
      token: student.token,
      body: { content: "Retry now" },
    });
    assert.equal(retrySse.status, 200);
    const retryEvents = parseSseEvents(retrySse.text);
    assert.ok(retryEvents.some((e) => e.done === true));
  });
});
