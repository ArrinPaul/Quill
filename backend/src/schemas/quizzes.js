const { z, LIMITS, titleSchema, uuidSchema } = require("./common");

const quizQuestionTypeSchema = z.preprocess(
  (v) => (v === "short_answer" ? "short" : v),
  z.enum(["mcq", "tf", "short"]).default("mcq")
);

const quizQuestionSchema = z
  .object({
    type: quizQuestionTypeSchema.optional(),
    question: z.string().trim().min(1, "Required").max(LIMITS.DESCRIPTION),
    options: z.array(z.string().max(LIMITS.DESCRIPTION)).min(1).max(LIMITS.ARRAY_ITEMS).nullable().optional(),
    correctIndex: z.number().int().min(0).nullable().optional(),
    modelAnswer: z.string().trim().max(LIMITS.DESCRIPTION).nullable().optional(),
    model_answer: z.string().trim().max(LIMITS.DESCRIPTION).nullable().optional(),
    explanation: z.string().max(LIMITS.DESCRIPTION).nullable().optional(),
    citation: z.string().max(LIMITS.DESCRIPTION).nullable().optional(),
  })
  .superRefine((q, ctx) => {
    const type = q.type || "mcq";
    if (type === "short") {
      const answer = (q.modelAnswer ?? q.model_answer ?? "").trim();
      if (!answer) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["modelAnswer"],
          message: "Model answer is required for short-answer questions",
        });
      }
      return;
    }

    if (!Array.isArray(q.options) || q.options.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Options are required",
      });
      return;
    }

    if (type === "tf" && q.options.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "True/False questions must have 2 options",
      });
    }

    if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctIndex"],
        message: "correctIndex must be a valid option index",
      });
    }
  });

const createQuizSchema = z.object({
  title: titleSchema,
  questions: z.array(quizQuestionSchema).min(1).max(LIMITS.ARRAY_ITEMS),
});

const submitQuizSchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: uuidSchema,
        user_answer_index: z.number().int().min(-1).nullable().optional(),
        user_answer_text: z.string().max(LIMITS.DESCRIPTION).nullable().optional(),
      })
    )
    .max(LIMITS.ARRAY_ITEMS),
});

module.exports = {
  createQuizSchema,
  submitQuizSchema,
};
