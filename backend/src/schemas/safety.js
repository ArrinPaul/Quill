const { z, uuidSchema } = require("./common");

const blockStudentSchema = z.object({
  studentId: uuidSchema,
});

const blockParamSchema = z.object({
  studentId: uuidSchema,
});

const createReportSchema = z.object({
  targetType: z.enum(["member", "message", "note", "deck", "board", "quiz", "other"]),
  targetId: uuidSchema,
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required")
    .max(500, "Reason must be at most 500 characters"),
});

const reportParamSchema = z.object({
  id: uuidSchema,
  reportId: uuidSchema,
});

const resolveReportSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
});

const removeMemberQuerySchema = z.object({
  ban: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return val;
    }, z.boolean().optional()),
});

const removeMemberBodySchema = z.object({
  ban: z.boolean().optional(),
  reason: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().trim().max(500, "Reason must be at most 500 characters").optional()
  ),
});

module.exports = {
  blockStudentSchema,
  blockParamSchema,
  createReportSchema,
  reportParamSchema,
  resolveReportSchema,
  removeMemberQuerySchema,
  removeMemberBodySchema,
};
