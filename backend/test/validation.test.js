const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");
const { setClient } = require("../src/services/supabase");

const MISSING_UUID = "11111111-1111-4111-8111-111111111111";

describe("B2 validation and central error handling", () => {
  let ctx;
  let userA;

  before(async () => {
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
  });

  after(async () => {
    await ctx.close();
  });

  it("returns 404 for invalid UUID route params across routes", async () => {
    const checks = [
      ["PUT", "/api/tasks/not-a-uuid", { title: "Valid" }],
      ["DELETE", "/api/tasks/not-a-uuid"],
      ["PUT", "/api/notices/not-a-uuid", { notice_text: "Valid" }],
      ["DELETE", "/api/notices/not-a-uuid"],
      ["DELETE", "/api/attendance/not-a-uuid"],
      ["GET", "/api/quizzes/not-a-uuid"],
      ["PATCH", "/api/quizzes/not-a-uuid/submit", { score: 1, answers: [] }],
      ["DELETE", "/api/quizzes/not-a-uuid"],
      ["POST", "/api/flashcards/decks/not-a-uuid/cards", { front: "a", back: "b" }],
      ["DELETE", "/api/flashcards/decks/not-a-uuid"],
      ["PUT", "/api/flashcards/not-a-uuid", { front: "a", back: "b" }],
      ["PATCH", "/api/flashcards/not-a-uuid/status", { status: "mastered" }],
      ["DELETE", "/api/flashcards/not-a-uuid"],
      ["GET", "/api/whiteboards/not-a-uuid"],
      ["PUT", "/api/whiteboards/not-a-uuid", { title: "Board" }],
      ["DELETE", "/api/whiteboards/not-a-uuid"],
    ];

    for (const [method, path, body] of checks) {
      const res = await ctx.request(method, path, { token: userA.token, body });
      assert.equal(res.status, 404, `${method} ${path} should return 404, got ${res.status}`);
    }

    const calRes = await ctx.request("GET", "/api/calendar/feed/not-a-uuid?token=abc");
    assert.equal(calRes.status, 404);
  });

  it("returns 400 with '<field>: <problem>' for invalid bodies and enforces spec limits", async () => {
    const deadline = new Date(Date.now() + 3600_000).toISOString();

    const tooLongTitle = await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: { title: "a".repeat(201), subject: "CS101", deadline },
    });
    assert.equal(tooLongTitle.status, 400);
    assert.match(tooLongTitle.data.message, /^title: /);

    const tooLongSubject = await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: { title: "Task", subject: "s".repeat(101), deadline },
    });
    assert.equal(tooLongSubject.status, 400);
    assert.match(tooLongSubject.data.message, /^subject: /);

    const tooLongDesc = await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: { title: "Task", subject: "CS101", description: "d".repeat(5001), deadline },
    });
    assert.equal(tooLongDesc.status, 400);
    assert.match(tooLongDesc.data.message, /^description: /);

    const badDate = await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: { title: "Task", subject: "CS101", deadline: "not-an-iso-date" },
    });
    assert.equal(badDate.status, 400);
    assert.match(badDate.data.message, /^deadline: /);

    const tooLongNotice = await ctx.request("POST", "/api/notices", {
      token: userA.token,
      body: { notice_text: "n".repeat(20001) },
    });
    assert.equal(tooLongNotice.status, 400);
    assert.match(tooLongNotice.data.message, /^notice_text: /);

    const tooLongNotes = await ctx.request("POST", "/api/ai/flashcards", {
      token: userA.token,
      body: { notes: "x".repeat(50001) },
    });
    assert.equal(tooLongNotes.status, 400);
    assert.match(tooLongNotes.data.message, /^notes: /);

    const tooManyCards = await ctx.request("POST", "/api/flashcards/decks", {
      token: userA.token,
      body: {
        title: "Big Deck",
        flashcards: Array.from({ length: 201 }, (_, i) => ({ front: `Q${i}`, back: `A${i}` })),
      },
    });
    assert.equal(tooManyCards.status, 400);
    assert.match(tooManyCards.data.message, /^flashcards: /);
  });

  it("returns 404 when deleting non-existent records", async () => {
    const deletePaths = [
      `/api/tasks/${MISSING_UUID}`,
      `/api/notices/${MISSING_UUID}`,
      `/api/attendance/${MISSING_UUID}`,
      `/api/quizzes/${MISSING_UUID}`,
      `/api/flashcards/${MISSING_UUID}`,
      `/api/flashcards/decks/${MISSING_UUID}`,
    ];

    for (const path of deletePaths) {
      const res = await ctx.request("DELETE", path, { token: userA.token });
      assert.equal(res.status, 404, `DELETE ${path} should return 404, got ${res.status}`);
    }
  });

  it("never leaks raw database error messages on 500", async () => {
    const originalDb = ctx.db;
    const failingBuilder = {
      select() { return this; },
      eq() { return this; },
      order() {
        return Promise.resolve({
          data: null,
          error: new Error("FATAL: password authentication failed for user postgres"),
        });
      },
    };
    const failingClient = {
      from(table) {
        if (table === "students") {
          return originalDb.from(table);
        }
        return failingBuilder;
      },
    };

    setClient(failingClient);
    try {
      const res = await ctx.request("GET", "/api/tasks", { token: userA.token });
      assert.equal(res.status, 500);
      assert.equal(res.data.message, "Something went wrong");
      assert.doesNotMatch(res.text, /postgres/i);
    } finally {
      setClient(originalDb);
    }
  });
});
