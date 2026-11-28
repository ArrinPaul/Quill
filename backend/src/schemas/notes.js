const { z, LIMITS } = require("./common");

const NOTE_CONTENT_MAX = 100_000;

const createNoteSchema = z.object({
  title: z.string().trim().max(LIMITS.TITLE).optional(),
  content: z.string().max(NOTE_CONTENT_MAX).optional(),
});

const updateNoteSchema = z
  .object({
    title: z.string().trim().max(LIMITS.TITLE).optional(),
    content: z.string().max(NOTE_CONTENT_MAX),
    version: z.number().int().min(1).optional(),
    force: z.boolean().optional(),
  })
  .refine((data) => data.force === true || typeof data.version === "number", {
    message: "version is required unless force is true",
    path: ["version"],
  });

const noteAiSchema = z.object({
  action: z.enum(["summarize", "expand", "tasks"]),
});

const noteTasksOutputSchema = z
  .array(
    z.object({
      title: z.string().trim().min(1).max(LIMITS.TITLE),
      subject: z.string().trim().max(LIMITS.SUBJECT).optional(),
      dueDate: z.string().trim().max(30).optional(),
    })
  )
  .min(1)
  .max(15);

module.exports = {
  NOTE_CONTENT_MAX,
  createNoteSchema,
  updateNoteSchema,
  noteAiSchema,
  noteTasksOutputSchema,
};
