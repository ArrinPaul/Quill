const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");
const { unsubscribeUrl } = require("../src/services/unsubscribe");

const hours = (n) => new Date(Date.now() + n * 3600000).toISOString();

describe("Step 5", () => {
  let ctx;
  let userA;
  let userB;
  const realFetch = global.fetch;
  let mail = [];
  let mailFails = false;

  before(async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Quill <test@example.com>";
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();
    // only the email provider is faked; requests to the test server pass through
    global.fetch = async (url, options) => {
      if (!String(url).startsWith("https://api.resend.com")) return realFetch(url, options);
      if (mailFails) return new Response("down", { status: 500 });
      mail.push(JSON.parse(options.body));
      return new Response("{}", { status: 200 });
    };
  });
  beforeEach(() => {
    mail = [];
    mailFails = false;
  });
  after(async () => {
    global.fetch = realFetch;
    delete process.env.CRON_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    await ctx.close();
  });

  const call = (method, path, user, body, headers) =>
    ctx.request(method, path, { token: user?.token, body, headers });
  const job = (name, secret = "cron-test-secret") =>
    call("POST", `/api/jobs/${name}`, null, undefined, { "x-cron-secret": secret });
  const newTask = async (user, extra = {}) =>
    (await call("POST", "/api/tasks", user, { title: "Essay", subject: "En", deadline: hours(24), reminder_time: hours(-1), ...extra })).data.task;

  it("refuses jobs without the right secret", async () => {
    assert.equal((await job("reminders", "wrong")).status, 401);
    assert.equal((await call("POST", "/api/jobs/reminders", userA)).status, 401);
    assert.equal((await job("digest", "")).status, 401);
  });

  it("sends each reminder once, only to people who opted in, and retries a failed send", async () => {
    await newTask(userA);
    await newTask(userB);
    assert.deepEqual((await job("reminders")).data, { sent: 0, failed: 0 });

    const on = await call("PUT", "/api/email-preferences", userA, { reminders: true });
    assert.equal(on.data.reminders, true);
    mailFails = true;
    assert.deepEqual((await job("reminders")).data, { sent: 0, failed: 1 });
    mailFails = false;
    assert.deepEqual((await job("reminders")).data, { sent: 1, failed: 0 });
    assert.deepEqual(mail.map((m) => m.to), [[userA.student.email]]);
    assert.deepEqual((await job("reminders")).data, { sent: 0, failed: 0 });
  });

  it("sends again only when the reminder time actually changes", async () => {
    const task = await newTask(userA);
    await job("reminders");
    await call("PUT", `/api/tasks/${task.id}`, userA, { title: "Renamed", reminder_time: task.reminder_time });
    assert.equal((await job("reminders")).data.sent, 0);
    await call("PUT", `/api/tasks/${task.id}`, userA, { reminder_time: hours(-2) });
    assert.equal((await job("reminders")).data.sent, 1);
  });

  it("sends one digest a week with a working unsubscribe link", async () => {
    await call("PUT", "/api/email-preferences", userB, { digest: true });
    assert.equal((await job("digest")).data.sent, 1);
    assert.equal((await job("digest")).data.sent, 0);
    assert.match(mail[0].text, /Essay/);

    const path = new URL(unsubscribeUrl(userB.student.id));
    const link = path.pathname + path.search;
    const page = await ctx.request("GET", link);
    assert.equal(page.status, 200);
    // opening the page changes nothing
    assert.equal((await call("GET", "/api/email-preferences", userB)).data.digest, true);
    assert.equal((await ctx.request("POST", link)).status, 200);
    assert.equal((await call("GET", "/api/email-preferences", userB)).data.digest, false);
    assert.equal((await ctx.request("POST", `/api/unsubscribe?token=${userA.student.id}.forged`)).status, 400);
  });

  it("reports only the caller's figures and rejects odd focus lengths", async () => {
    assert.equal((await call("POST", "/api/activity/focus", userA, { minutes: 25 })).status, 200);
    for (const minutes of [0, 181, 2.5]) {
      assert.equal((await call("POST", "/api/activity/focus", userA, { minutes })).status, 400, String(minutes));
    }
    const done = await newTask(userA);
    await call("PUT", `/api/tasks/${done.id}`, userA, { status: "completed" });

    const mine = (await call("GET", "/api/reports/me?range=7", userA)).data;
    assert.equal(mine.tasks.completed, 1);
    assert.equal(mine.tasks.onTimeRate, 100);
    assert.equal(mine.focus.totalMinutes, 25);
    const theirs = (await call("GET", "/api/reports/me?range=7", userB)).data;
    assert.equal(theirs.tasks.completed, 0);
    assert.equal(theirs.tasks.onTimeRate, null);
    assert.equal(theirs.focus.totalMinutes, 0);
    assert.equal((await call("GET", "/api/reports/me?range=365", userA)).status, 400);
    assert.equal((await call("GET", "/api/reports/me", null)).status, 401);
  });

  it("shares a note read-only until it is revoked or deleted", async () => {
    const note = (await call("POST", "/api/notes", userA, { title: "Shared", content: "body" })).data.note;
    const target = { resource_type: "note", resource_id: note.id };
    assert.equal((await call("POST", "/api/share-links", userB, target)).status, 404);

    const first = await call("POST", "/api/share-links", userA, target);
    assert.equal(first.status, 201);
    const seen = await call("GET", `/api/public/${first.data.token}`);
    assert.deepEqual(seen.data, { type: "note", title: "Shared", content: "body" });
    assert.ok(!JSON.stringify(ctx.db.tables.share_links).includes(first.data.token));

    const second = await call("POST", "/api/share-links", userA, target);
    assert.equal((await call("GET", `/api/public/${first.data.token}`)).status, 404);
    assert.equal((await call("DELETE", `/api/share-links/${second.data.link.id}`, userB)).status, 404);
    assert.equal((await call("DELETE", `/api/share-links/${second.data.link.id}`, userA)).status, 200);
    assert.equal((await call("GET", `/api/public/${second.data.token}`)).status, 404);

    const third = await call("POST", "/api/share-links", userA, target);
    await call("DELETE", `/api/notes/${note.id}`, userA);
    assert.equal((await call("GET", `/api/public/${third.data.token}`)).status, 404);
  });

  it("shares a deck without study progress or ids", async () => {
    const deck = (await call("POST", "/api/flashcards/decks", userA, { title: "D", flashcards: [{ front: "f", back: "b" }] })).data.deck;
    const link = await call("POST", "/api/share-links", userA, { resource_type: "deck", resource_id: deck.id });
    const seen = await call("GET", `/api/public/${link.data.token}`);
    assert.equal(seen.data.title, "D");
    assert.deepEqual(Object.keys(seen.data).sort(), ["cards", "title", "type"]);
  });
});
