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
  type: z.enum(["mcq", "short_answer", "mixed"]).optional(),
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

module.exports = {
  attendanceAlertSchema,
  chatSchema,
  notesSchema,
  quizGenerateSchema,
  gradeShortAnswerSchema,
  toolParamsSchema,
  toolBodySchema,
};
