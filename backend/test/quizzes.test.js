const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");

describe("Quizzes ownership and validation", () => {
  let ctx;
  let userA;
  let userB;
  let quizA;
  let questionA;

  before(async () => {
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();
  });

  after(async () => {
    await ctx.close();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await ctx.request("GET", "/api/quizzes");
    assert.equal(res.status, 401);
  });

  it("validates quiz payload", async () => {
    const res = await ctx.request("POST", "/api/quizzes", {
      token: userA.token,
      body: { title: "Bad quiz" },
    });
    assert.equal(res.status, 400);
  });

  it("creates a quiz for user A and enforces ownership across all routes", async () => {
    const createRes = await ctx.request("POST", "/api/quizzes", {
      token: userA.token,
      body: {
        title: "OS Quiz",
        questions: [
          {
            question: "What is a process?",
            options: ["Program in execution", "Disk file", "CPU core", "Socket"],
            correctIndex: 0,
            explanation: "A process is a running program.",
          },
        ],
      },
    });
    assert.equal(createRes.status, 201);
    quizA = createRes.data.quiz;
    questionA = createRes.data.questions[0];

    const listB = await ctx.request("GET", "/api/quizzes", { token: userB.token });
    assert.equal(listB.status, 200);
    assert.equal(listB.data.quizzes.length, 0);

    const getB = await ctx.request("GET", `/api/quizzes/${quizA.id}`, { token: userB.token });
    assert.equal(getB.status, 404);

    const submitB = await ctx.request("PATCH", `/api/quizzes/${quizA.id}/submit`, {
      token: userB.token,
      body: {
        score: 100,
        answers: [{ question_id: questionA.id, user_answer_index: 0, is_correct: true }],
      },
    });
    assert.equal(submitB.status, 404);

    await ctx.request("DELETE", `/api/quizzes/${quizA.id}`, { token: userB.token });

    const getA = await ctx.request("GET", `/api/quizzes/${quizA.id}`, { token: userA.token });
    assert.equal(getA.status, 200);
    assert.equal(getA.data.quiz.title, "OS Quiz");
  });
});
