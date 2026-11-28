const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { z } = require("../schemas/common");
const { isEmailConfigured } = require("../services/email");
const { readUnsubscribeToken } = require("../services/unsubscribe");

const preferences = express.Router();
preferences.use(authMiddleware);

const preferencesSchema = z
  .object({ reminders: z.boolean().optional(), digest: z.boolean().optional() })
  .refine((v) => v.reminders !== undefined || v.digest !== undefined, { message: "Nothing to change" });

const shape = (row) => ({
  reminders: Boolean(row.email_reminders),
  digest: Boolean(row.email_digest),
  available: isEmailConfigured(),
});

preferences.get("/", async (req, res, next) => {
  try {
    const { data, error } = await getClient()
      .from("students")
      .select("email_reminders, email_digest")
      .eq("id", req.student.id)
      .single();
    if (error) throw error;
    res.json(shape(data));
  } catch (error) {
    next(error);
  }
});

preferences.put("/", validate({ body: preferencesSchema }), async (req, res, next) => {
  try {
    const { reminders, digest } = req.body;
    const patch = {};
    if (reminders !== undefined) patch.email_reminders = reminders;
    if (digest !== undefined) patch.email_digest = digest;
    const { data, error } = await getClient()
      .from("students")
      .update(patch)
      .eq("id", req.student.id)
      .select("email_reminders, email_digest")
      .single();
    if (error) throw error;
    res.json(shape(data));
  } catch (error) {
    next(error);
  }
});

// The link in the email opens a confirm page; only the button changes anything,
// so mail scanners that follow links cannot unsubscribe anyone.
const unsubscribe = express.Router();

const page = (body) =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Quill email</title><body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem">${body}</body></html>`;

unsubscribe.get("/", (req, res) => {
  const token = String(req.query.token || "");
  if (!readUnsubscribeToken(token)) return res.status(400).send(page("<p>This link is not valid.</p>"));
  // The token has passed its signature check, so it holds only an id and base64url characters.
  res.send(
    page(
      `<h1>Stop the weekly email?</h1><form method="post" action="?token=${encodeURIComponent(token)}"><button type="submit">Stop weekly emails</button></form>`
    )
  );
});

unsubscribe.post("/", async (req, res, next) => {
  try {
    const studentId = readUnsubscribeToken(req.query.token);
    if (!studentId) return res.status(400).send(page("<p>This link is not valid.</p>"));
    const { error } = await getClient().from("students").update({ email_digest: false }).eq("id", studentId);
    if (error) throw error;
    res.send(page("<p>Done. You will not get the weekly email again.</p>"));
  } catch (error) {
    next(error);
  }
});

module.exports = { preferences, unsubscribe };
