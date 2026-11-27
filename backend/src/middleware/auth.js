const jwt = require("jsonwebtoken");
const { getClient } = require("../services/supabase");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  // Developer mode bypass
  if (process.env.DEV_MODE === "true" && process.env.NODE_ENV !== "production" && token === "dev-token") {
    req.student = {
      id: "00000000-0000-0000-0000-000000000000",
      name: "Developer",
      email: "dev@example.com",
      branch: "Computer Science",
      year: 4,
      subjects: ["CS101", "CS102"],
      created_at: new Date().toISOString()
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose) throw new Error("Not a session token");

    // Reject tokens that outlive a deleted account or a password change/reset
    const { data, error } = await getClient()
      .from("students")
      .select("id, token_version")
      .eq("id", decoded.id)
      .maybeSingle();
    if (error) return res.status(503).json({ message: "Could not verify your session. Please try again." });
    if (!data) return res.status(401).json({ message: "Account no longer exists" });
    if ((decoded.tv ?? 0) !== (data.token_version ?? 0)) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    req.student = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

module.exports = authMiddleware;
