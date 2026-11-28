const { z, uuidSchema, idParamSchema } = require("./common");

const inviteParamSchema = z.object({
  id: uuidSchema,
  inviteId: uuidSchema,
});

const createInviteSchema = z.object({
  expiresInDays: z.number().int().min(1).max(30).default(7),
  maxUses: z.number().int().min(1).max(100).default(25),
});

module.exports = {
  idParamSchema,
  inviteParamSchema,
  createInviteSchema,
};
