const { z, LIMITS, titleSchema, uuidSchema } = require("./common");

const deckIdParamSchema = z.object({
  deckId: uuidSchema,
});

const cardStatusSchema = z.enum(["unseen", "review", "mastered"]);

const cardInputSchema = z.object({
  front: z.string().trim().min(1, "Required").max(LIMITS.DESCRIPTION),
  back: z.string().trim().min(1, "Required").max(LIMITS.DESCRIPTION),
  citation: z.string().trim().max(LIMITS.DESCRIPTION).nullable().optional(),
  status: cardStatusSchema.optional(),
});

const createDeckSchema = z.object({
  title: titleSchema,
  flashcards: z.array(cardInputSchema).min(1).max(LIMITS.ARRAY_ITEMS),
});

const renameDeckSchema = z.object({
  title: titleSchema,
});

const updateCardStatusSchema = z.object({
  status: cardStatusSchema,
});

module.exports = {
  deckIdParamSchema,
  cardInputSchema,
  createDeckSchema,
  renameDeckSchema,
  updateCardStatusSchema,
};
