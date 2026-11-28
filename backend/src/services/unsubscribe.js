const crypto = require("crypto");

const sign = (studentId) =>
  crypto.createHmac("sha256", process.env.JWT_SECRET).update(`unsubscribe:${studentId}`).digest("base64url");

/** The web host forwards /api to this server, so the link uses the app's own address. */
function unsubscribeUrl(studentId) {
  const base = (process.env.FRONTEND_URL || "http://localhost:3000").split(",")[0].trim().replace(/\/$/, "");
  return `${base}/api/unsubscribe?token=${studentId}.${sign(studentId)}`;
}

/** Returns the student id, or null if the token is not one we signed. */
function readUnsubscribeToken(token) {
  const [studentId, signature] = String(token || "").split(".");
  if (!studentId || !signature) return null;
  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(studentId));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? studentId : null;
}

module.exports = { unsubscribeUrl, readUnsubscribeToken };
