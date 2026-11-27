function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }

  const status =
    Number.isInteger(err?.status) && err.status >= 400 && err.status < 600
      ? err.status
      : 500;

  const message =
    status === 500
      ? "Something went wrong"
      : err?.message || "Something went wrong";

  res.status(status).json({ message });
}

module.exports = errorHandler;
