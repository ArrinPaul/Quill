const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createFakeSupabase } = require("./helpers/fakeSupabase");

describe("fakeSupabase", () => {
  it("throws on unsupported client or query builder methods", () => {
    const db = createFakeSupabase();
    assert.throws(() => db.rpc("some_fn"), /Unsupported Supabase client method/);
    assert.throws(() => db.from("tasks").neq("status", "done"), /Unsupported Supabase query method/);
  });

  it("supports upsert with onConflict", async () => {
    const db = createFakeSupabase({
      preferences: [{ id: "p1", user_id: "u1", theme: "light" }],
    });

    const { data, error } = await db
      .from("preferences")
      .upsert({ user_id: "u1", theme: "dark" }, { onConflict: "user_id" })
      .select()
      .single();

    assert.equal(error, null);
    assert.equal(data.id, "p1");
    assert.equal(data.theme, "dark");
  });
});
