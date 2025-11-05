const { sendError } = require("../utils/response.util");

const errorHandler = (err, req, res, next) => {
  console.error("❌ Global error:", err);

  if (res.headersSent) return next(err);

  return sendError(res, err.status || 500, err.message || "Lỗi hệ thống", {
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

module.exports = errorHandler;
