const {
  z,
  LIMITS,
  titleSchema,
  subjectSchema,
  isoDateSchema,
  optionalIsoDateSchema,
} = require("./common");

const importanceSchema = z.enum(["low", "normal", "high"]);
const statusSchema = z.enum(["pending", "in_progress", "completed", "cancelled"]);
const repeatSchema = z.enum(["none", "weekly"]);

const createTaskSchema = z.object({
  title: titleSchema,
  subject: subjectSchema,
  description: z.string().max(LIMITS.DESCRIPTION).nullable().optional(),
  deadline: isoDateSchema,
  reminder_time: optionalIsoDateSchema,
  add_to_calendar: z.boolean().optional(),
  importance: importanceSchema.optional(),
  status: statusSchema.optional(),
  repeat: repeatSchema.optional(),
});

const updateTaskSchema = z.object({
  title: titleSchema.optional(),
  subject: subjectSchema.optional(),
  description: z.string().max(LIMITS.DESCRIPTION).nullable().optional(),
  deadline: isoDateSchema.optional(),
  reminder_time: optionalIsoDateSchema,
  status: statusSchema.optional(),
  importance: importanceSchema.optional(),
  repeat: repeatSchema.optional(),
});

module.exports = {
  createTaskSchema,
  updateTaskSchema,
};
