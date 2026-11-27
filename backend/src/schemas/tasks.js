const {
  z,
  LIMITS,
  titleSchema,
  subjectSchema,
  isoDateSchema,
  optionalIsoDateSchema,
} = require("./common");

const importanceSchema = z.enum(["low", "normal", "high"]);

const createTaskSchema = z.object({
  title: titleSchema,
  subject: subjectSchema,
  description: z.string().max(LIMITS.DESCRIPTION).nullable().optional(),
  deadline: isoDateSchema,
  reminder_time: optionalIsoDateSchema,
  add_to_calendar: z.boolean().optional(),
  importance: importanceSchema.optional(),
});

const updateTaskSchema = z.object({
  title: titleSchema.optional(),
  subject: subjectSchema.optional(),
  description: z.string().max(LIMITS.DESCRIPTION).nullable().optional(),
  deadline: isoDateSchema.optional(),
  reminder_time: optionalIsoDateSchema,
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
  importance: importanceSchema.optional(),
});

module.exports = {
  createTaskSchema,
  updateTaskSchema,
};
