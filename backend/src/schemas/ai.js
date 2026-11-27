const { z, LIMITS, subjectSchema } = require("./common");

const attendanceAlertSchema = z
  .object({
    subject: subjectSchema,
    total: z.number().int().min(0),
    attended: z.number().int().min(0),
    threshold: z.number().finite().min(0).max(100).optional(),
  })
  .refine((data) => data.attended <= data.total, {
    message: "Attended classes cannot exceed total classes",
    path: ["attended"],
  });

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().trim().min(1, "Required").max(LIMITS.AI_NOTES),
      })
    )
    .min(1)
    .max(LIMITS.ARRAY_ITEMS),
});

const notesSchema = z.object({
  notes: z.string().trim().min(1, "Required").max(LIMITS.AI_NOTES),
});

const quizGenerateSchema = z.object({
  notes: z.string().trim().min(1, "Required").max(LIMITS.AI_NOTES),
  count: z.number().int().min(1).max(50).optional(),
  type: z.enum(["mcq", "tf", "short_answer", "mixed"]).optional(),
});

const gradeShortAnswerSchema = z.object({
  question: z.string().trim().min(1, "Required").max(LIMITS.DESCRIPTION),
  modelAnswer: z.string().trim().min(1, "Required").max(LIMITS.DESCRIPTION),
  userAnswer: z.string().max(LIMITS.DESCRIPTION),
});

const toolParamsSchema = z.object({
  toolSlug: z.string().trim().min(1, "Required").max(LIMITS.SUBJECT),
});

const toolBodySchema = z.object({
  content: z.string().max(LIMITS.AI_NOTES).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

// --- AI JSON output validation schemas ---

const flashcardOutputSchema = z.object({
  front: z.string().trim().min(1),
  back: z.string().trim().min(1),
  citation: z.string().trim().optional(),
});

const flashcardsOutputSchema = z.array(flashcardOutputSchema).min(1).max(30);

const mcqQuizQuestionOutputSchema = z
  .object({
    question: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().optional(),
    citation: z.string().trim().optional(),
  })
  .refine((q) => q.correctIndex >= 0 && q.correctIndex < q.options.length, {
    message: "correctIndex out of range",
  });

const tfQuizQuestionOutputSchema = z
  .object({
    question: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).length(2),
    correctIndex: z.number().int().min(0).max(1),
    explanation: z.string().trim().optional(),
    citation: z.string().trim().optional(),
  })
  .refine((q) => q.correctIndex >= 0 && q.correctIndex < q.options.length, {
    message: "correctIndex out of range",
  });

const shortAnswerQuizQuestionOutputSchema = z.object({
  question: z.string().trim().min(1),
  modelAnswer: z.string().trim().min(1),
  explanation: z.string().trim().optional(),
  citation: z.string().trim().optional(),
});

function getQuizOutputSchema(type = "mcq") {
  if (type === "tf") {
    return z.array(tfQuizQuestionOutputSchema).min(1).max(50);
  }
  if (type === "short_answer" || type === "short") {
    return z.array(shortAnswerQuizQuestionOutputSchema).min(1).max(50);
  }
  if (type === "mixed") {
    return z
      .array(
        z.union([
          mcqQuizQuestionOutputSchema,
          tfQuizQuestionOutputSchema,
          shortAnswerQuizQuestionOutputSchema,
        ])
      )
      .min(1)
      .max(50);
  }
  return z.array(mcqQuizQuestionOutputSchema).min(1).max(50);
}

const gradeShortAnswerOutputSchema = z.object({
  score: z.number().finite().min(0).max(100),
  feedback: z.string().trim().min(1),
  isCorrect: z.boolean(),
});

module.exports = {
  attendanceAlertSchema,
  chatSchema,
  notesSchema,
  quizGenerateSchema,
  gradeShortAnswerSchema,
  toolParamsSchema,
  toolBodySchema,
  flashcardsOutputSchema,
  getQuizOutputSchema,
  gradeShortAnswerOutputSchema,
};
