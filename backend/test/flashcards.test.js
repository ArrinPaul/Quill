const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");

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
});
