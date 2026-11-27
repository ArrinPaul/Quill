const { z } = require("./common");

const focusSchema = z.object({
  minutes: z.number().finite().positive().max(1440),
});

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = {
  focusSchema,
  recentQuerySchema,
};
