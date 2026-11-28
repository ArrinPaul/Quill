const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");
const { setClient } = require("../src/services/supabase");

describe("Activity log and GET /api/activity/recent", () => {
  let ctx;
  let userA;
  let userB;

  before(async () => {
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();
  });

  after(async () => {
    await ctx.close();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await ctx.request("GET", "/api/activity/recent");
    assert.equal(res.status, 401);
  });

  it("validates limit query parameter", async () => {
    const tooLarge = await ctx.request("GET", "/api/activity/recent?limit=101", {
      token: userA.token,
    });
    assert.equal(tooLarge.status, 400);

    const invalid = await ctx.request("GET", "/api/activity/recent?limit=abc", {
      token: userA.token,
    });
    assert.equal(invalid.status, 400);
  });

  it("logs each action once, deduplicates completions, and isolates by student", async () => {
    const deadline = new Date(Date.now() + 3600_000).toISOString();

    // 1. task_created
    const taskRes = await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: { title: "Read Chapter 4", subject: "CS101", deadline },
    });
    assert.equal(taskRes.status, 200);
    const taskId = taskRes.data.task.id;

    // 2. task_completed (and duplicate completion)
    const complete1 = await ctx.request("PUT", `/api/tasks/${taskId}`, {
      token: userA.token,
      body: { status: "completed" },
    });
    assert.equal(complete1.status, 200);

    const uncomplete = await ctx.request("PUT", `/api/tasks/${taskId}`, {
      token: userA.token,
      body: { status: "pending" },
    });
    assert.equal(uncomplete.status, 200);

    const complete2 = await ctx.request("PUT", `/api/tasks/${taskId}`, {
      token: userA.token,
      body: { status: "completed" },
    });
    assert.equal(complete2.status, 200);

    // 3. notice_added
    const noticeRes = await ctx.request("POST", "/api/notices", {
      token: userA.token,
      body: { notice_text: "Lab cancelled tomorrow", event_title: "Lab Notice" },
    });
    assert.equal(noticeRes.status, 200);
    const noticeId = noticeRes.data.notice.id;

    // 4. quiz_completed (create quiz, submit, retake, submit again)
    const quizRes = await ctx.request("POST", "/api/quizzes", {
      token: userA.token,
      body: {
        title: "OS Quiz 1",
        questions: [
          {
            question: "What is a process?",
            options: ["A program in execution", "A file", "A thread", "A port"],
            correctIndex: 0,
            explanation: "A process is an executing program.",
          },
        ],
      },
    });
    assert.equal(quizRes.status, 201);
    const quizId = quizRes.data.quiz.id;
    const questionId = quizRes.data.questions[0].id;

    const submit1 = await ctx.request("PATCH", `/api/quizzes/${quizId}/submit`, {
      token: userA.token,
      body: {
        score: 1,
        answers: [{ question_id: questionId, user_answer_index: 0, is_correct: true }],
      },
    });
    assert.equal(submit1.status, 200);

    const retake = await ctx.request("POST", `/api/quizzes/${quizId}/retake`, { token: userA.token });
    assert.equal(retake.status, 200);

    const submit2 = await ctx.request("PATCH", `/api/quizzes/${quizId}/submit`, {
      token: userA.token,
      body: {
        score: 1,
        answers: [{ question_id: questionId, user_answer_index: 0, is_correct: true }],
      },
    });
    assert.equal(submit2.status, 200);

    // 5. deck_created
    const deckRes = await ctx.request("POST", "/api/flashcards/decks", {
      token: userA.token,
      body: {
        title: "Algorithms Deck",
        flashcards: [{ front: "BFS", back: "Breadth-First Search" }],
      },
    });
    assert.equal(deckRes.status, 201);
    const deckId = deckRes.data.deck.id;

    // 6. board_created
    const boardRes = await ctx.request("POST", "/api/whiteboards", {
      token: userA.token,
      body: { title: "System Architecture" },
    });
    assert.equal(boardRes.status, 200);
    const boardId = boardRes.data.whiteboard.id;

    // Verify userA sees exactly the 6 expected activity items
    const recentA = await ctx.request("GET", "/api/activity/recent", {
      token: userA.token,
    });
    assert.equal(recentA.status, 200);
    const items = recentA.data.items;
    assert.equal(items.length, 6);

    const byType = new Map(items.map((item) => [item.type, item]));
    assert.equal(byType.get("task_created")?.entity_id, taskId);
    assert.equal(byType.get("task_created")?.title, "Read Chapter 4");
    assert.equal(byType.get("task_completed")?.entity_id, taskId);
    assert.equal(byType.get("notice_added")?.entity_id, noticeId);
    assert.equal(byType.get("notice_added")?.title, "Lab Notice");
    assert.equal(byType.get("quiz_completed")?.entity_id, quizId);
    assert.equal(byType.get("quiz_completed")?.title, "OS Quiz 1");
    assert.equal(byType.get("deck_created")?.entity_id, deckId);
    assert.equal(byType.get("board_created")?.entity_id, boardId);

    for (const item of items) {
      assert.ok(item.id);
      assert.ok(item.created_at);
      assert.equal(item.student_id, undefined);
    }

    // Verify limit parameter works
    const limited = await ctx.request("GET", "/api/activity/recent?limit=2", {
      token: userA.token,
    });
    assert.equal(limited.status, 200);
    assert.equal(limited.data.items.length, 2);

    // Verify userB sees none of userA's activity
    const recentB = await ctx.request("GET", "/api/activity/recent", {
      token: userB.token,
    });
    assert.equal(recentB.status, 200);
    assert.deepEqual(recentB.data.items, []);
  });

  it("does not fail user action when activity logging fails", async () => {
    const originalDb = ctx.db;
    const failingDb = {
      from(table) {
        if (table === "activity_log") {
          throw new Error("Simulated activity_log failure");
        }
        return originalDb.from(table);
      },
    };

    setClient(failingDb);
    try {
      const deadline = new Date(Date.now() + 7200_000).toISOString();
      const res = await ctx.request("POST", "/api/tasks", {
        token: userB.token,
        body: { title: "Survives logging failure", subject: "MATH201", deadline },
      });
      assert.equal(res.status, 200);
      assert.equal(res.data.task.title, "Survives logging failure");
    } finally {
      setClient(originalDb);
    }
  });
});
