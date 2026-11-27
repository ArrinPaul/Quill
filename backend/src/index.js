const path = require("path");
// Load backend/.env if present, then fall back to the repo-root .env
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");
const noticeRoutes = require("./routes/notices");
const attendanceRoutes = require("./routes/attendance");
const aiRoutes = require("./routes/ai");
const quizRoutes = require("./routes/quizzes");
const whiteboardRoutes = require("./routes/whiteboards");
const calendarRoutes = require("./routes/calendar");
const flashcardsRoutes = require("./routes/flashcards");
const achievementsRoutes = require("./routes/achievements");
const activityRoutes = require("./routes/activity");

const app = express();
const PORT = process.env.PORT || 4000;

// Only the web app's own origin(s) may call the API from a browser. Comma-separate to allow several.
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/whiteboards", whiteboardRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/flashcards", flashcardsRoutes);
app.use("/api/achievements", achievementsRoutes);
app.use("/api/activity", activityRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Quill backend running on port ${PORT}`);
});
