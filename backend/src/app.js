const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");
const noticeRoutes = require("./routes/notices");
const attendanceRoutes = require("./routes/attendance");
const aiRoutes = require("./routes/ai");
const aiConversationsRoutes = require("./routes/aiConversations");
const quizRoutes = require("./routes/quizzes");
const whiteboardRoutes = require("./routes/whiteboards");
const calendarRoutes = require("./routes/calendar");
const flashcardsRoutes = require("./routes/flashcards");
const achievementsRoutes = require("./routes/achievements");
const activityRoutes = require("./routes/activity");
const notesRoutes = require("./routes/notes");
const searchRoutes = require("./routes/search");
const jobRoutes = require("./routes/jobs");
const reportRoutes = require("./routes/reports");
const shareRoutes = require("./routes/share");
const emailRoutes = require("./routes/email");
const groupsRoutes = require("./routes/groups");
const invitesRoutes = require("./routes/invites");

const { generalLimiter } = require("./middleware/rateLimit");

const app = express();
app.set("trust proxy", 1);

// Only the web app's own origin(s) may call the API from a browser. Comma-separate to allow several.
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""));
app.use(cors({ origin: allowedOrigins }));
// A 100,000 character note is larger than the 100kb default.
app.use(express.json({ limit: "1mb" }));
app.use("/api", generalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/ai/conversations", aiConversationsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/whiteboards", whiteboardRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/flashcards", flashcardsRoutes);
app.use("/api/achievements", achievementsRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/share-links", shareRoutes.links);
app.use("/api/public", shareRoutes.publicShare);
app.use("/api/email-preferences", emailRoutes.preferences);
app.use("/api/unsubscribe", emailRoutes.unsubscribe);
app.use("/api/groups", groupsRoutes);
app.use("/api/invites", invitesRoutes);

const errorHandler = require("./middleware/errors");

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(errorHandler);

module.exports = app;
