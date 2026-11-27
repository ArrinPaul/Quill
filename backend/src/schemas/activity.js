const { z } = require("./common");

const focusSchema = z.object({
  minutes: z.number().finite().positive().max(1440),
});

module.exports = {
  focusSchema,
};
