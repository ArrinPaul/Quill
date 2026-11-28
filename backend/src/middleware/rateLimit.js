const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const jwt = require("jsonwebtoken");

function isRateLimitDisabled() {
  if (process.env.ENABLE_RATE_LIMIT === "1" || process.env.ENABLE_RATE_LIMIT === "true") {
    return false;
  }
  return process.env.DISABLE_RATE_LIMIT === "1" || process.env.NODE_ENV === "test";
}

function rateLimitHandler(req, res, _next, options) {
  const resetMs = req.rateLimit?.resetTime
    ? Math.max(0, req.rateLimit.resetTime.getTime() - Date.now())
    : options.windowMs;
  const minutes = Math.max(1, Math.ceil(resetMs / 60000));
  res.status(429).json({
    message: `Too many attempts. Try again in ${minutes} minutes.`,
  });
}

function createLimiter(options) {
  return rateLimit({
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: isRateLimitDisabled,
    handler: rateLimitHandler,
    ...options,
  });
}

function userOrIpKey(req) {
  if (req.student?.id) {
    return `user:${req.student.id}`;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && !decoded.purpose && decoded.id) {
        return `user:${decoded.id}`;
      }
    } catch {
      // Invalid/expired token falls back to IP
    }
  }
  return ipKeyGenerator(req.ip || "127.0.0.1");
}

// 10 requests per 15 minutes per IP for login, register, forgot, reset, check-email
const authIpLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
});

// Additional 10 requests per 15 minutes per normalized email for login
const loginEmailLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: (req) =>
    isRateLimitDisabled() ||
    typeof req.body?.email !== "string" ||
    !req.body.email.trim(),
  keyGenerator: (req) => `email:${req.body.email.trim().toLowerCase()}`,
});

// 30 requests per hour per user for /api/ai/* (except /api/ai/tip)
const aiLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: userOrIpKey,
});

// 300 requests per 5 minutes per user or IP for everything else
const generalLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  keyGenerator: userOrIpKey,
});

// Shared links need no login, so limit them by IP
const publicLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
});

module.exports = {
  publicLimiter,
  authIpLimiter,
  loginEmailLimiter,
  aiLimiter,
  generalLimiter,
};
