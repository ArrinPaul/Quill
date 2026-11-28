const { z, uuidSchema, idParamSchema } = require("./common");

const groupNameSchema = z
  .string()
  .trim()
  .min(3, "Must be at least 3 characters")
  .max(60, "Must be at most 60 characters");

const groupDescriptionSchema = z.preprocess(
  (val) => (val === "" ? null : val),
  z.string().trim().max(500, "Must be at most 500 characters").nullable().optional()
);

const createGroupSchema = z.object({
  name: groupNameSchema,
  description: groupDescriptionSchema,
});

const updateGroupSchema = z
  .object({
    name: groupNameSchema.optional(),
    description: groupDescriptionSchema,
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "At least one field must be provided",
  });

const deleteGroupSchema = z.object({
  confirmName: z.string().trim().min(1, "Required").max(60),
});

const memberParamSchema = z.object({
  id: uuidSchema,
  sid: uuidSchema,
});

const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

const transferOwnershipSchema = z.object({
  studentId: uuidSchema,
});

module.exports = {
  idParamSchema,
  memberParamSchema,
  createGroupSchema,
  updateGroupSchema,
  deleteGroupSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
};
