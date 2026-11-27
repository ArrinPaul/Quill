const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");
const { calculateSm2 } = require("../src/routes/flashcards");

describe("Flashcards ownership and validation (all routes)", () => {
  let ctx;
  let userA;
  let userB;
  let deckA;
  let cardA;

  before(async () => {
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();
  });

  after(async () => {
    await ctx.close();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await ctx.request("GET", "/api/flashcards/decks");
    assert.equal(res.status, 401);
  });

  it("validates deck creation payload", async () => {
    const res = await ctx.request("POST", "/api/flashcards/decks", {
      token: userA.token,
      body: { title: "Empty", flashcards: [] },
    });
    assert.equal(res.status, 400);
  });

  it("creates a deck and enforces ownership on GET /decks and POST /decks/:deckId/cards", async () => {
    const createRes = await ctx.request("POST", "/api/flashcards/decks", {
      token: userA.token,
      body: {
        title: "Networks",
        flashcards: [{ front: "TCP", back: "Transmission Control Protocol" }],
      },
    });
    assert.equal(createRes.status, 201);
    deckA = createRes.data.deck;
    cardA = createRes.data.flashcards[0];

    const listA = await ctx.request("GET", "/api/flashcards/decks", { token: userA.token });
    assert.equal(listA.status, 200);
    assert.equal(listA.data.decks.length, 1);
    assert.equal(listA.data.decks[0].flashcards.length, 1);

    const listB = await ctx.request("GET", "/api/flashcards/decks", { token: userB.token });
    assert.equal(listB.status, 200);
    assert.equal(listB.data.decks.length, 0);

    const addCardB = await ctx.request("POST", `/api/flashcards/decks/${deckA.id}/cards`, {
      token: userB.token,
      body: { front: "UDP", back: "User Datagram Protocol" },
    });
    assert.equal(addCardB.status, 404);

    const addCardA = await ctx.request("POST", `/api/flashcards/decks/${deckA.id}/cards`, {
      token: userA.token,
      body: { front: "UDP", back: "User Datagram Protocol" },
    });
    assert.equal(addCardA.status, 201);
  });

  it("enforces ownership on PUT /:id, PATCH /:id/status, DELETE /:id, and DELETE /decks/:deckId", async () => {
    const putB = await ctx.request("PUT", `/api/flashcards/${cardA.id}`, {
      token: userB.token,
      body: { front: "Hacked", back: "Hacked" },
    });
    assert.equal(putB.status, 404);

    const putA = await ctx.request("PUT", `/api/flashcards/${cardA.id}`, {
      token: userA.token,
      body: { front: "TCP/IP", back: "Transmission Control Protocol" },
    });
    assert.equal(putA.status, 200);
    assert.equal(putA.data.card.front, "TCP/IP");

    const statusB = await ctx.request("PATCH", `/api/flashcards/${cardA.id}/status`, {
      token: userB.token,
      body: { status: "mastered" },
    });
    assert.equal(statusB.status, 404);

    const badStatusA = await ctx.request("PATCH", `/api/flashcards/${cardA.id}/status`, {
      token: userA.token,
      body: { status: "unknown" },
    });
    assert.equal(badStatusA.status, 400);

    const statusA = await ctx.request("PATCH", `/api/flashcards/${cardA.id}/status`, {
      token: userA.token,
      body: { status: "mastered" },
    });
    assert.equal(statusA.status, 200);
    assert.equal(statusA.data.card.status, "mastered");

    const delCardB = await ctx.request("DELETE", `/api/flashcards/${cardA.id}`, {
      token: userB.token,
    });
    assert.equal(delCardB.status, 404);

    await ctx.request("DELETE", `/api/flashcards/decks/${deckA.id}`, {
      token: userB.token,
    });

    const listAAfterB = await ctx.request("GET", "/api/flashcards/decks", { token: userA.token });
    assert.equal(listAAfterB.data.decks.length, 1);

    const delCardA = await ctx.request("DELETE", `/api/flashcards/${cardA.id}`, {
      token: userA.token,
    });
    assert.equal(delCardA.status, 200);

    const delDeckA = await ctx.request("DELETE", `/api/flashcards/decks/${deckA.id}`, {
      token: userA.token,
    });
    assert.equal(delDeckA.status, 200);

    const listAEnd = await ctx.request("GET", "/api/flashcards/decks", { token: userA.token });
    assert.equal(listAEnd.data.decks.length, 0);
  });

  it("renames a deck via PUT /api/flashcards/decks/:id with auth, validation, and ownership checks", async () => {
    const createRes = await ctx.request("POST", "/api/flashcards/decks", {
      token: userA.token,
      body: {
        title: "Original Deck",
        flashcards: [{ front: "Q1", back: "A1" }],
      },
    });
    assert.equal(createRes.status, 201);
    const createdDeck = createRes.data.deck;

    // 401 unauthenticated
    const unauthRes = await ctx.request("PUT", `/api/flashcards/decks/${createdDeck.id}`, {
      body: { title: "No Auth" },
    });
    assert.equal(unauthRes.status, 401);

    // 404 invalid UUID
    const badIdRes = await ctx.request("PUT", "/api/flashcards/decks/not-a-uuid", {
      token: userA.token,
      body: { title: "Valid Title" },
    });
    assert.equal(badIdRes.status, 404);

    // 400 invalid title (empty / whitespace / missing / too long)
    const emptyTitleRes = await ctx.request("PUT", `/api/flashcards/decks/${createdDeck.id}`, {
      token: userA.token,
      body: { title: "   " },
    });
    assert.equal(emptyTitleRes.status, 400);

    const missingTitleRes = await ctx.request("PUT", `/api/flashcards/decks/${createdDeck.id}`, {
      token: userA.token,
      body: {},
    });
    assert.equal(missingTitleRes.status, 400);

    // 404 other user
    const otherUserRes = await ctx.request("PUT", `/api/flashcards/decks/${createdDeck.id}`, {
      token: userB.token,
      body: { title: "Stolen Title" },
    });
    assert.equal(otherUserRes.status, 404);

    // 404 missing deck UUID
    const missingDeckRes = await ctx.request(
      "PUT",
      "/api/flashcards/decks/00000000-0000-4000-8000-000000000099",
      {
        token: userA.token,
        body: { title: "Ghost Deck" },
      }
    );
    assert.equal(missingDeckRes.status, 404);

    // 200 success
    const renameRes = await ctx.request("PUT", `/api/flashcards/decks/${createdDeck.id}`, {
      token: userA.token,
      body: { title: "  Renamed Deck  " },
    });
    assert.equal(renameRes.status, 200);
    assert.equal(renameRes.data.deck.id, createdDeck.id);
    assert.equal(renameRes.data.deck.title, "Renamed Deck");
  });
});

describe("SM-2 spaced repetition calculation", () => {
  const fixedNow = Date.UTC(2026, 0, 1, 12, 0, 0);

  it("advances repetitions, intervals, and ease factor on mastered", () => {
    const first = calculateSm2({ repetitions: 0, interval_days: 0, ease_factor: 2.5 }, "mastered", fixedNow);
    assert.equal(first.repetitions, 1);
    assert.equal(first.intervalDays, 1);
    assert.equal(first.easeFactor, 2.6);
    assert.equal(first.nextReviewAt, new Date(fixedNow + 86400000).toISOString());

    const second = calculateSm2(
      { repetitions: first.repetitions, interval_days: first.intervalDays, ease_factor: first.easeFactor },
      "mastered",
      fixedNow
    );
    assert.equal(second.repetitions, 2);
    assert.equal(second.intervalDays, 6);
    assert.ok(Math.abs(second.easeFactor - 2.7) < 1e-9);
    assert.equal(second.nextReviewAt, new Date(fixedNow + 6 * 86400000).toISOString());

    const third = calculateSm2(
      { repetitions: second.repetitions, interval_days: second.intervalDays, ease_factor: second.easeFactor },
      "mastered",
      fixedNow
    );
    assert.equal(third.repetitions, 3);
    assert.equal(third.intervalDays, Math.round(6 * 2.7));
    assert.ok(Math.abs(third.easeFactor - 2.8) < 1e-9);
  });

  it("resets repetitions and interval and clamps ease factor to 1.3 on review", () => {
    const res = calculateSm2({ repetitions: 4, interval_days: 15, ease_factor: 1.4 }, "review", fixedNow);
    assert.equal(res.repetitions, 0);
    assert.equal(res.intervalDays, 0);
    assert.equal(res.easeFactor, 1.3);
    assert.equal(res.nextReviewAt, new Date(fixedNow).toISOString());
  });

  it("resets repetitions and interval on unseen without altering ease factor", () => {
    const res = calculateSm2({ repetitions: 3, interval_days: 10, ease_factor: 2.2 }, "unseen", fixedNow);
    assert.equal(res.repetitions, 0);
    assert.equal(res.intervalDays, 0);
    assert.equal(res.easeFactor, 2.2);
    assert.equal(res.nextReviewAt, new Date(fixedNow).toISOString());
  });
});
