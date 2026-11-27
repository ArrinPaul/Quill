function formatZodError(error) {
  const issue = error.issues?.[0];
  if (!issue) return "input: Invalid input";
  const field = issue.path && issue.path.length > 0 ? issue.path.join(".") : "input";
  return `${field}: ${issue.message}`;
}

function isUuidIssue(issue) {
  return (
    issue &&
    (issue.format === "uuid" || issue.validation === "uuid")
  );
}

function validate({ body, params, query } = {}) {
  return (req, res, next) => {
    if (params) {
      const parsed = params.safeParse(req.params);
      if (!parsed.success) {
        const hasUuidError = parsed.error.issues?.some(isUuidIssue);
        if (hasUuidError) {
          return res.status(404).json({ message: "Not found" });
        }
        return res.status(400).json({ message: formatZodError(parsed.error) });
      }
      req.params = parsed.data;
    }

    if (query) {
      const parsed = query.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ message: formatZodError(parsed.error) });
      }
      req.query = parsed.data;
    }

    if (body) {
      const parsed = body.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: formatZodError(parsed.error) });
      }
      req.body = parsed.data;
    }

    next();
  };
}

module.exports = validate;
