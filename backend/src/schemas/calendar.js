const { z, uuidSchema } = require("./common");

const studentIdParamSchema = z.object({
  student_id: uuidSchema,
});

module.exports = {
  studentIdParamSchema,
};
