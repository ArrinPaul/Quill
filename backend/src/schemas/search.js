const { z } = require("./common");

const searchQuerySchema = z.object({
  q: z.string().trim().min(2, "Type at least 2 characters").max(100),
});

module.exports = {
  searchQuerySchema,
};
