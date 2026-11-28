const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");
const {
  AIError,
  setGroqClient,
  setCompleter,
  setAiTimeoutMs,
} = require("../src/services/groq");

describe("B9 AI limits, timeout, and output validation", () => {
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
    setCompleter(null);
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

  it("rejects unauthenticated requests with 401", async () => {
    for (const [path, body] of [
      ["/api/ai/chat", { messages: [{ role: "user", content: "Hi" }] }],
      ["/api/ai/flashcards", { notes: "OS concepts" }],
      ["/api/ai/quiz", { notes: "OS concepts" }],
      [
        "/api/ai/grade-short-answer",
        { question: "Q?", modelAnswer: "A", userAnswer: "A" },
      ],
    ]) {
      const res = await ctx.request("POST", path, { body });
      assert.equal(res.status, 401, `Expected 401 for ${path}`);
    }
  });

  it("enforces AI_DAILY_LIMIT per student and returns 429 'Daily AI limit reached'", async () => {
    process.env.AI_DAILY_LIMIT = "2";
    setCompleter(async () => "Helpful study reply");

    const r1 = await ctx.request("POST", "/api/ai/chat", {
      token: userA.token,
      body: { messages: [{ role: "user", content: "Explain paging" }] },
    });
    assert.equal(r1.status, 200);
    assert.equal(r1.data.reply, "Helpful study reply");

    const r2 = await ctx.request("POST", "/api/ai/chat", {
      token: userA.token,
      body: { messages: [{ role: "user", content: "Explain segmentation" }] },
    });
    assert.equal(r2.status, 200);

    const blocked = await ctx.request("POST", "/api/ai/chat", {
      token: userA.token,
      body: { messages: [{ role: "user", content: "One more" }] },
    });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.data.message, "Daily AI limit reached");

    // Another student still has their own quota
    const other = await ctx.request("POST", "/api/ai/chat", {
      token: userB.token,
      body: { messages: [{ role: "user", content: "Hello" }] },
    });
    assert.equal(other.status, 200);
  });

  it("returns 503, saves nothing, and refunds quota on malformed flashcard output", async () => {
    process.env.AI_DAILY_LIMIT = "1";
    const student = await ctx.registerStudent();

    // 1. Non-JSON output
    setCompleter(async () => "Not valid JSON at all");
    const badJson = await ctx.request("POST", "/api/ai/flashcards", {
      token: student.token,
      body: { notes: "TCP uses a 3-way handshake." },
    });
    assert.equal(badJson.status, 503);

    // 2. Empty array (violates min 1)
    setCompleter(async () => JSON.stringify([]));
    const emptyArr = await ctx.request("POST", "/api/ai/flashcards", {
      token: student.token,
      body: { notes: "TCP uses a 3-way handshake." },
    });
    assert.equal(emptyArr.status, 503);

    // 3. > 30 items (violates max 30)
    const tooMany = Array.from({ length: 31 }, (_, i) => ({
      front: `Q${i}`,
      back: `A${i}`,
    }));
    setCompleter(async () => JSON.stringify(tooMany));
    const overMax = await ctx.request("POST", "/api/ai/flashcards", {
      token: student.token,
      body: { notes: "TCP uses a 3-way handshake." },
    });
    assert.equal(overMax.status, 503);

    // Quota was refunded each time, so a valid call still succeeds with limit=1
    assert.equal(
      ctx.db.tables.ai_usage?.find((r) => r.student_id === student.student.id)?.count,
      0
    );
    assert.equal(ctx.db.tables.flashcard_decks?.length || 0, 0);
    assert.equal(ctx.db.tables.flashcards?.length || 0, 0);

    setCompleter(async () =>
      JSON.stringify([
        { front: "What is TCP handshake?", back: "SYN, SYN-ACK, ACK", citation: "3-way handshake" },
      ])
    );
    const valid = await ctx.request("POST", "/api/ai/flashcards", {
      token: student.token,
      body: { notes: "TCP uses a 3-way handshake." },
    });
    assert.equal(valid.status, 200);
    assert.equal(valid.data.flashcards.length, 1);
  });

  it("validates quiz output shapes by type and refunds quota on malformed output", async () => {
    process.env.AI_DAILY_LIMIT = "10";
    const student = await ctx.registerStudent();

    // MCQ with wrong options count (3 instead of 4) -> 503 + refund
    setCompleter(async () =>
      JSON.stringify([
        { question: "Q1?", options: ["A", "B", "C"], correctIndex: 0 },
      ])
    );
    const badMcq = await ctx.request("POST", "/api/ai/quiz", {
      token: student.token,
      body: { notes: "Some notes", type: "mcq", count: 1 },
    });
    assert.equal(badMcq.status, 503);
    assert.equal(
      ctx.db.tables.ai_usage?.find((r) => r.student_id === student.student.id)?.count,
      0
    );

    // MCQ with out-of-range correctIndex -> 503 + refund
    setCompleter(async () =>
      JSON.stringify([
        { question: "Q1?", options: ["A", "B", "C", "D"], correctIndex: 4 },
      ])
    );
    const badIdx = await ctx.request("POST", "/api/ai/quiz", {
      token: student.token,
      body: { notes: "Some notes", type: "mcq", count: 1 },
    });
    assert.equal(badIdx.status, 503);
    assert.equal(
      ctx.db.tables.ai_usage?.find((r) => r.student_id === student.student.id)?.count,
      0
    );

    // TF with invalid correctIndex (2) -> 503 + refund
    setCompleter(async () =>
      JSON.stringify([
        { question: "Earth is round?", options: ["True", "False"], correctIndex: 2 },
      ])
    );
    const badTf = await ctx.request("POST", "/api/ai/quiz", {
      token: student.token,
      body: { notes: "Some notes", type: "tf", count: 1 },
    });
    assert.equal(badTf.status, 503);
    assert.equal(
      ctx.db.tables.ai_usage?.find((r) => r.student_id === student.student.id)?.count,
      0
    );

    // Valid short_answer -> 200 and increments quota to 1
    setCompleter(async () =>
      JSON.stringify([
        { question: "Define deadlock.", modelAnswer: "Circular wait for resources." },
      ])
    );
    const validShort = await ctx.request("POST", "/api/ai/quiz", {
      token: student.token,
      body: { notes: "Deadlock notes", type: "short_answer", count: 1 },
    });
    assert.equal(validShort.status, 200);
    assert.equal(validShort.data.questions.length, 1);
    assert.equal(
      ctx.db.tables.ai_usage?.find((r) => r.student_id === student.student.id)?.count,
      1
    );
  });

  it("validates short-answer grade output and refunds quota on malformed output", async () => {
    const student = await ctx.registerStudent();

    // Score > 100 -> 503 + refund
    setCompleter(async () =>
      JSON.stringify({ score: 150, feedback: "Great", isCorrect: true })
    );
    const badScore = await ctx.request("POST", "/api/ai/grade-short-answer", {
      token: student.token,
      body: { question: "Q", modelAnswer: "A", userAnswer: "A" },
    });
    assert.equal(badScore.status, 503);
    assert.equal(
      ctx.db.tables.ai_usage?.find((r) => r.student_id === student.student.id)?.count,
      0
    );

    // Valid grade -> 200
    setCompleter(async () =>
      JSON.stringify({ score: 85, feedback: "Covers main points.", isCorrect: true })
    );
    const goodGrade = await ctx.request("POST", "/api/ai/grade-short-answer", {
      token: student.token,
      body: { question: "Q", modelAnswer: "A", userAnswer: "A" },
    });
    assert.equal(goodGrade.status, 200);
    assert.equal(goodGrade.data.score, 85);
    assert.equal(goodGrade.data.isCorrect, true);
  });

  it("enforces timeout (503) and refunds quota on timeout or provider failure", async () => {
    const student = await ctx.registerStudent();
    assert.equal(new AIError().status, 503);

    // 1. Timeout simulation
    setAiTimeoutMs(25);
    setCompleter(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve("too late"), 200);
        })
    );
    const timedOut = await ctx.request("POST", "/api/ai/chat", {
      token: student.token,
      body: { messages: [{ role: "user", content: "Hello" }] },
    });
    assert.equal(timedOut.status, 503);
    assert.equal(
      ctx.db.tables.ai_usage?.find((r) => r.student_id === student.student.id)?.count,
      0
    );

    // 2. Provider failure via setGroqClient
    setCompleter(null);
    setAiTimeoutMs(null);
    setGroqClient({
      chat: {
        completions: {
          create: async () => {
            throw new Error("Groq 502 Bad Gateway");
          },
        },
      },
    });
    const failed = await ctx.request("POST", "/api/ai/chat", {
      token: student.token,
      body: { messages: [{ role: "user", content: "Hello" }] },
    });
    assert.equal(failed.status, 503);
    assert.equal(
      ctx.db.tables.ai_usage?.find((r) => r.student_id === student.student.id)?.count,
      0
    );
  });
});
