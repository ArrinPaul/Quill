const { z, subjectSchema } = require("./common");

const upsertAttendanceSchema = z
  .object({
    subject: subjectSchema,
    total_classes: z.number().int().min(0),
    attended_classes: z.number().int().min(0),
    threshold: z
      .preprocess(
        (val) => (val === "" || val === null || val === undefined ? 75 : Number(val)),
        z.number().finite().min(0).max(100)
      )
      .optional()
      .default(75),
  })
  .refine((data) => data.attended_classes <= data.total_classes, {
    message: "Attended classes cannot exceed total classes",
    path: ["attended_classes"],
  });

module.exports = {
  upsertAttendanceSchema,
};
