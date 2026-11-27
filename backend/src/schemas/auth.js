const { z, LIMITS, subjectSchema } = require("./common");

const emailSchema = z.string().trim().toLowerCase().email("Invalid email address").max(LIMITS.TITLE);
const yearSchema = z.union([
  z.number().int().min(1).max(10),
  z.string().trim().min(1).max(50),
]);
const subjectsArraySchema = z.array(subjectSchema).max(LIMITS.ARRAY_ITEMS);

const checkEmailSchema = z.object({
  email: emailSchema,
});

const registerSchema = z.object({
  name: z.string().trim().min(1, "Required").max(LIMITS.TITLE),
  email: emailSchema,
  password: z.string().min(6, "Must be at least 6 characters").max(LIMITS.TITLE),
  branch: z.string().trim().min(1, "Required").max(LIMITS.TITLE),
  year: yearSchema,
  subjects: subjectsArraySchema.optional().default([]),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Required").max(LIMITS.TITLE),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Required").max(LIMITS.TITLE).optional(),
  branch: z.string().trim().min(1, "Required").max(LIMITS.TITLE).optional(),
  year: yearSchema.optional(),
  subjects: subjectsArraySchema.optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Required").max(LIMITS.TITLE),
  newPassword: z.string().min(6, "Must be at least 6 characters").max(LIMITS.TITLE),
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Required").max(LIMITS.DESCRIPTION),
  newPassword: z.string().min(6, "Must be at least 6 characters").max(LIMITS.TITLE),
});

module.exports = {
  checkEmailSchema,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
