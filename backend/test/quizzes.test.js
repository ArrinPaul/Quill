const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");
const { setCompleter } = require("../src/services/groq");

describe("Quizzes ownership, validation, grading, and retake", () => {
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

  afterEach(() => {
    setCompleter(null);
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

  it("creates a quiz for user A, hides answers before submit, and enforces ownership across all routes", async () => {
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
            citation: "A process is a program in execution.",
          },
        ],
      },
    });
    assert.equal(createRes.status, 201);
    quizA = createRes.data.quiz;
    questionA = createRes.data.questions[0];
    assert.equal(questionA.correct_index, undefined);

    const listB = await ctx.request("GET", "/api/quizzes", { token: userB.token });
    assert.equal(listB.status, 200);
    assert.equal(listB.data.quizzes.length, 0);

    const getB = await ctx.request("GET", `/api/quizzes/${quizA.id}`, { token: userB.token });
    assert.equal(getB.status, 404);

    const submitB = await ctx.request("PATCH", `/api/quizzes/${quizA.id}/submit`, {
      token: userB.token,
      body: {
        answers: [{ question_id: questionA.id, user_answer_index: 0 }],
      },
    });
    assert.equal(submitB.status, 404);

    const retakeB = await ctx.request("POST", `/api/quizzes/${quizA.id}/retake`, {
      token: userB.token,
    });
    assert.equal(retakeB.status, 404);

    await ctx.request("DELETE", `/api/quizzes/${quizA.id}`, { token: userB.token });

    const getA = await ctx.request("GET", `/api/quizzes/${quizA.id}`, { token: userA.token });
    assert.equal(getA.status, 200);
    assert.equal(getA.data.quiz.title, "OS Quiz");
    assert.equal(getA.data.questions[0].correct_index, undefined);
    assert.equal(getA.data.questions[0].model_answer, undefined);
  });

  it("computes score on the server and ignores client score and is_correct", async () => {
    const createRes = await ctx.request("POST", "/api/quizzes", {
      token: userA.token,
      body: {
        title: "Server Graded MCQ",
        questions: [
          {
            type: "mcq",
            question: "2 + 2 = ?",
            options: ["3", "4", "5", "6"],
            correctIndex: 1,
            explanation: "2 + 2 equals 4.",
          },
          {
            type: "tf",
            question: "Earth is flat.",
            options: ["True", "False"],
            correctIndex: 1,
            explanation: "Earth is an oblate spheroid.",
          },
        ],
      },
    });
    assert.equal(createRes.status, 201);
    const quiz = createRes.data.quiz;
    const [q1, q2] = createRes.data.questions;

    // Client tries to spoof score: 100 and is_correct: true while picking wrong index 0 on q1
    const submitRes = await ctx.request("PATCH", `/api/quizzes/${quiz.id}/submit`, {
      token: userA.token,
      body: {
        score: 100,
        answers: [
          { question_id: q1.id, user_answer_index: 0, is_correct: true },
          { question_id: q2.id, user_answer_index: 1, is_correct: false },
        ],
      },
    });
    assert.equal(submitRes.status, 200);
    assert.equal(submitRes.data.quiz.score, 50);
    assert.equal(submitRes.data.questions[0].is_correct, false);
    assert.equal(submitRes.data.questions[0].correct_index, 1);
    assert.equal(submitRes.data.questions[1].is_correct, true);
    assert.equal(submitRes.data.questions[1].correct_index, 1);
  });

  it("grades short-answer quizzes via AI, saves nothing on 503 failure, and supports retake", async () => {
    const createRes = await ctx.request("POST", "/api/quizzes", {
      token: userA.token,
      body: {
        title: "Short Answer Quiz",
        questions: [
          {
            type: "short",
            question: "What is virtual memory?",
            modelAnswer: "An abstraction that gives each process its own address space.",
            explanation: "Virtual memory isolates process address spaces.",
            citation: "Virtual memory maps virtual addresses to physical frames.",
          },
        ],
      },
    });
    assert.equal(createRes.status, 201);
    const quiz = createRes.data.quiz;
    const [q1] = createRes.data.questions;
    assert.equal(q1.model_answer, undefined);

    const getBefore = await ctx.request("GET", `/api/quizzes/${quiz.id}`, { token: userA.token });
    assert.equal(getBefore.status, 200);
    assert.equal(getBefore.data.questions[0].model_answer, undefined);

    // 1. Grading failure: returns 503, saves nothing, refunds quota
    setCompleter(async () => {
      throw new Error("Groq downstream error");
    });

    const failSubmit = await ctx.request("PATCH", `/api/quizzes/${quiz.id}/submit`, {
      token: userA.token,
      body: {
        answers: [{ question_id: q1.id, user_answer_text: "It maps virtual addresses." }],
      },
    });
    assert.equal(failSubmit.status, 503);

    const getAfterFail = await ctx.request("GET", `/api/quizzes/${quiz.id}`, { token: userA.token });
    assert.equal(getAfterFail.status, 200);
    assert.equal(getAfterFail.data.quiz.score, null);
    assert.equal(getAfterFail.data.questions[0].user_answer_text, null);
    assert.equal(getAfterFail.data.questions[0].is_correct, null);
    assert.equal(getAfterFail.data.questions[0].feedback, null);
    assert.equal(getAfterFail.data.questions[0].model_answer, undefined);

    const usageRows = ctx.db.tables.ai_usage.filter((r) => r.student_id === userA.student.id);
    assert.equal(usageRows[0]?.count ?? 0, 0);

    // 2. Grading succeeds
    setCompleter(async () =>
      JSON.stringify({
        score: 85,
        feedback: "Good explanation of address space abstraction.",
        isCorrect: true,
      })
    );

    const okSubmit = await ctx.request("PATCH", `/api/quizzes/${quiz.id}/submit`, {
      token: userA.token,
      body: {
        answers: [{ question_id: q1.id, user_answer_text: "It gives processes private address spaces." }],
      },
    });
    assert.equal(okSubmit.status, 200);
    assert.equal(okSubmit.data.quiz.score, 100);
    assert.equal(okSubmit.data.questions[0].is_correct, true);
    assert.equal(okSubmit.data.questions[0].feedback, "Good explanation of address space abstraction.");
    assert.equal(
      okSubmit.data.questions[0].model_answer,
      "An abstraction that gives each process its own address space."
    );

    // 3. Retake clears answers, score, feedback, and hides model_answer again
    const retakeRes = await ctx.request("POST", `/api/quizzes/${quiz.id}/retake`, {
      token: userA.token,
    });
    assert.equal(retakeRes.status, 200);
    assert.equal(retakeRes.data.quiz.score, null);
    assert.equal(retakeRes.data.questions[0].user_answer_text, null);
    assert.equal(retakeRes.data.questions[0].user_answer_index, null);
    assert.equal(retakeRes.data.questions[0].is_correct, null);
    assert.equal(retakeRes.data.questions[0].feedback, null);
    assert.equal(retakeRes.data.questions[0].model_answer, undefined);
  });
});
