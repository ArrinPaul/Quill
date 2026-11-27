const { z } = require("zod");

const LIMITS = {
  TITLE: 200,
  DESCRIPTION: 5000,
  NOTICE_TEXT: 20000,
  AI_NOTES: 50000,
  SUBJECT: 100,
  ARRAY_ITEMS: 200,
};

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const uuidSchema = z.string().uuid("Invalid ID");

const idParamSchema = z.object({
  id: uuidSchema,
});

const isoDateSchema = z
  .string()
  .trim()
  .refine((val) => ISO_DATE_RE.test(val) && !Number.isNaN(Date.parse(val)), {
    message: "Invalid ISO date",
  });

const optionalIsoDateSchema = z.preprocess(
  (val) => (val === "" ? null : val),
  isoDateSchema.nullable().optional()
);

const titleSchema = z.string().trim().min(1, "Required").max(LIMITS.TITLE);
const subjectSchema = z.string().trim().min(1, "Required").max(LIMITS.SUBJECT);

module.exports = {
  z,
  LIMITS,
  uuidSchema,
  idParamSchema,
  isoDateSchema,
  optionalIsoDateSchema,
  titleSchema,
  subjectSchema,
};
