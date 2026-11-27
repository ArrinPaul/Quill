const { z, LIMITS, optionalIsoDateSchema } = require("./common");

const noticeBodySchema = z.object({
  notice_text: z.string().trim().min(1, "Required").max(LIMITS.NOTICE_TEXT),
  event_title: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().trim().max(LIMITS.TITLE).nullable().optional()
  ),
  event_date: optionalIsoDateSchema,
});

module.exports = {
  noticeBodySchema,
};
