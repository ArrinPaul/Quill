require("dotenv").config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");
const noticeRoutes = require("./routes/notices");
const attendanceRoutes = require("./routes/attendance");
const aiRoutes = require("./routes/ai");
const quizRoutes = require("./routes/quizzes");
const googleRoutes = require("./routes/google");
const whiteboardRoutes = require("./routes/whiteboards");
const calendarRoutes = require("./routes/calendar");
const flashcardsRoutes = require("./routes/flashcards");
const achievementsRoutes = require("./routes/achievements");
const activityRoutes = require("./routes/activity");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/auth/google", googleRoutes);
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
