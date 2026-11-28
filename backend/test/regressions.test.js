const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");
const { setCompleter, setStreamCompleter } = require("../src/services/groq");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe("Regressions found reviewing steps 1-3", () => {
  let ctx;
  let user;
  const usage = () =>
    (ctx.db.tables?.ai_usage || []).filter((r) => r.student_id === user.student.id)
      .reduce((n, r) => n + r.count, 0);

  before(async () => {
    ctx = await startTestServer();
    user = await ctx.registerStudent();
  });
  afterEach(() => setStreamCompleter(null));
  after(() => ctx.close());

  const newChat = async () =>
    (await ctx.request("POST", "/api/ai/conversations", { token: user.token, body: {} })).data.conversation.id;
  const messages = async (id) =>
    (await ctx.request("GET", `/api/ai/conversations/${id}/messages`, { token: user.token })).data.messages;

  it("a wrong current password is 400, not 401 (401 signs the browser out)", async () => {
    const res = await ctx.request("PUT", "/api/auth/password", {
      token: user.token,
      body: { currentPassword: "not-the-password", newPassword: "another-password" },
    });
    assert.equal(res.status, 400);
  });

  it("the attendance calculation does not use the daily AI quota", async () => {
    const before = usage();
    const res = await ctx.request("POST", "/api/ai/attendance-alert", {
      token: user.token,
      body: { subject: "Math", total: 10, attended: 8 },
    });
    assert.equal(res.status, 200);
    assert.equal(usage(), before);
  });

  it("accepts a note at the 100,000 character limit", async () => {
    const res = await ctx.request("POST", "/api/notes", {
      token: user.token,
      body: { title: "Big", content: "é".repeat(100_000) },
    });
    assert.equal(res.status, 201);
  });

  it("stopping a reply aborts the model call and keeps the charge once text was sent", async () => {
    let aborted = false;
    setStreamCompleter(async (_p, { signal, onDelta }) => {
      onDelta("partial");
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 3000);
        signal.addEventListener("abort", () => { aborted = true; clearTimeout(t); resolve(); });
      });
      return "";
    });
    const id = await newChat();
    const before = usage();
    const controller = new AbortController();
    const res = await fetch(`${ctx.baseUrl}/api/ai/conversations/${id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: "stop me" }),
      signal: controller.signal,
    });
    await res.body.getReader().read();
    controller.abort();
    await wait(200);
    assert.equal(aborted, true);
    assert.equal(usage(), before + 1);
  });

  it("retrying a failed message does not store the question twice", async () => {
    const id = await newChat();
    const send = () => ctx.request("POST", `/api/ai/conversations/${id}/messages`, {
      token: user.token, body: { content: "same question" },
    });
    setStreamCompleter(async () => { throw new Error("provider down"); });
    await send();
    setStreamCompleter(async () => "answer");
    await send();
    assert.deepEqual((await messages(id)).map((m) => m.role), ["user", "assistant"]);
  });

  it("does not send internal error text down the stream", async () => {
    const id = await newChat();
    const realFrom = ctx.db.from.bind(ctx.db);
    ctx.db.from = (table) => {
      const q = realFrom(table);
      if (table === "ai_messages") {
        const insert = q.insert.bind(q);
        q.insert = (row) => {
          if (row.role === "assistant") throw new Error("relation secret_table does not exist");
          return insert(row);
        };
      }
      return q;
    };
    setStreamCompleter(async () => "answer");
    const res = await ctx.request("POST", `/api/ai/conversations/${id}/messages`, {
      token: user.token, body: { content: "hi" },
    });
    ctx.db.from = realFrom;
    assert.match(res.text, /"error"/);
    assert.doesNotMatch(res.text, /secret_table/);
  });
});

describe("Quiz submission and upload quota", () => {
  let ctx;
  let user;
  const usage = () =>
    (ctx.db.tables.ai_usage || []).filter((r) => r.student_id === user.student.id)
      .reduce((n, r) => n + r.count, 0);

  before(async () => {
    ctx = await startTestServer();
    user = await ctx.registerStudent();
  });
  afterEach(() => setCompleter(null));
  after(() => ctx.close());

  const newShortQuiz = async () => {
    const res = await ctx.request("POST", "/api/quizzes", {
      token: user.token,
      body: {
        title: "Short",
        questions: [1, 2, 3].map((n) => ({ type: "short", question: `Q${n}`, modelAnswer: "A" })),
      },
    });
    return { id: res.data.quiz.id, answers: res.data.questions.map((q) => ({ question_id: q.id, user_answer_text: "x" })) };
  };
  const submit = ({ id, answers }) =>
    ctx.request("PATCH", `/api/quizzes/${id}/submit`, { token: user.token, body: { answers } });
  const grader = async () => JSON.stringify({ score: 90, feedback: "ok", isCorrect: true });

  it("counts one AI use per graded answer and refuses a second submission", async () => {
    setCompleter(grader);
    const quiz = await newShortQuiz();
    const start = usage();
    assert.equal((await submit(quiz)).status, 200);
    assert.equal(usage(), start + 3);
    assert.equal((await submit(quiz)).status, 409);
    assert.equal(usage(), start + 3);
  });

  it("refunds every charge when grading fails or the limit is too low", async () => {
    const quiz = await newShortQuiz();
    const start = usage();
    setCompleter(async () => { throw new Error("down"); });
    assert.equal((await submit(quiz)).status, 503);
    assert.equal(usage(), start);

    process.env.AI_DAILY_LIMIT = String(start + 2);
    setCompleter(grader);
    assert.equal((await submit(quiz)).status, 429);
    assert.equal(usage(), start);
    delete process.env.AI_DAILY_LIMIT;
  });

  it("reading a document does not use the daily AI quota", async () => {
    const form = new FormData();
    form.append("document", new Blob(["plain text"]), "a.txt");
    const start = usage();
    const res = await fetch(`${ctx.baseUrl}/api/ai/parse-document`, {
      method: "POST", headers: { Authorization: `Bearer ${user.token}` }, body: form,
    });
    assert.equal(res.status, 200);
    assert.equal(usage(), start);
  });
});
