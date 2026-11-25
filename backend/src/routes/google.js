const express = require("express");
const { getClient } = require("../services/supabase");
const { getAuthUrl, getTokensFromCode, getValidAccessToken } = require("../services/google");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

router.get("/url", (req, res) => {
  const { state } = req.query;
  if (!state) {
    return res.status(400).json({ message: "Student state is required to link Google Calendar" });
  }
  const url = getAuthUrl(state);
  res.json({ url });
});

router.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/dashboard/settings?calendar_error=missing_params`);
  }

  try {
    const tokens = await getTokensFromCode(code);
    const supabase = getClient();

    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("id", state)
      .single();

    if (!student) {
      return res.redirect(`${FRONTEND_URL}/dashboard/settings?calendar_error=student_not_found`);
    }

    const { data: existingPref } = await supabase
      .from("preferences")
      .select("settings")
      .eq("user_id", student.id)
      .single();

    const existingSettings = (existingPref && existingPref.settings) || {};

    await supabase.from("preferences").upsert(
      {
        user_id: student.id,
        settings: {
          ...existingSettings,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token || existingSettings.google_refresh_token,
          google_calendar_connected: true,
          google_token_expiry: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
        },
      },
      { onConflict: "user_id" }
    );

    res.redirect(`${FRONTEND_URL}/dashboard/settings?calendar=connected`);
  } catch (error) {
    console.error("Google Calendar OAuth error:", error);
    res.redirect(`${FRONTEND_URL}/dashboard/settings?calendar_error=oauth_failed`);
  }
});

router.post("/calendar/events", authMiddleware, async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req.student.id);
    if (!accessToken) {
      return res.status(400).json({ message: "Google Calendar not connected" });
    }

    const { createCalendarEvent } = require("../services/google");
    const event = await createCalendarEvent(accessToken, req.body);
    res.json({ event });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/calendar/events", authMiddleware, async (req, res) => {
  try {
    const accessToken = await getValidAccessToken(req.student.id);
    if (!accessToken) {
      return res.status(400).json({ message: "Google Calendar not connected" });
    }

    const { getCalendarEvents } = require("../services/google");
    const events = await getCalendarEvents(accessToken);
    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/status", authMiddleware, async (req, res) => {
  try {
    const supabase = getClient();
    const { data: prefs } = await supabase
      .from("preferences")
      .select("settings")
      .eq("user_id", req.student.id)
      .single();

    const isConnected = !!prefs?.settings?.google_refresh_token;
    res.json({ connected: isConnected });
  } catch (error) {
    res.json({ connected: false });
  }
});

module.exports = router;
