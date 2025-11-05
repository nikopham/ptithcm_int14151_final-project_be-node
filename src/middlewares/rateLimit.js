const rateLimit = require("express-rate-limit");

module.exports = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10000, // giới hạn 100 requests
  message: {
    success: false,
    code: 429,
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau",
    data: {},
  },
  legacyHeaders: false,
  standardHeaders: true,
});
