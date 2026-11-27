const { z, LIMITS, titleSchema, uuidSchema } = require("./common");

const quizQuestionSchema = z.object({
  question: z.string().trim().min(1, "Required").max(LIMITS.DESCRIPTION),
  options: z.array(z.string().max(LIMITS.DESCRIPTION)).min(1).max(LIMITS.ARRAY_ITEMS),
  correctIndex: z.number().int().min(0),
  explanation: z.string().max(LIMITS.DESCRIPTION).nullable().optional(),
  citation: z.string().max(LIMITS.DESCRIPTION).nullable().optional(),
});

const createQuizSchema = z.object({
  title: titleSchema,
  questions: z.array(quizQuestionSchema).min(1).max(LIMITS.ARRAY_ITEMS),
});

const submitQuizSchema = z.object({
  score: z.number().finite().min(0),
  answers: z
    .array(
      z.object({
        question_id: uuidSchema,
        user_answer_index: z.number().int().min(0),
        is_correct: z.boolean(),
      })
    )
    .max(LIMITS.ARRAY_ITEMS),
});

module.exports = {
  createQuizSchema,
  submitQuizSchema,
};
