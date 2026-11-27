const { z, LIMITS } = require("./common");

const createWhiteboardSchema = z.object({
  title: z.string().trim().min(1, "Required").max(LIMITS.TITLE).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  thumbnail: z.string().max(LIMITS.AI_NOTES).nullable().optional(),
});

const updateWhiteboardSchema = z.object({
  title: z.string().trim().min(1, "Required").max(LIMITS.TITLE).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  thumbnail: z.string().max(LIMITS.AI_NOTES).nullable().optional(),
});

module.exports = {
  createWhiteboardSchema,
  updateWhiteboardSchema,
};
