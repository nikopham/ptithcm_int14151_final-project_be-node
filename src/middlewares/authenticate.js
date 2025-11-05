const jwt = require("jsonwebtoken");
const { sendError } = require("../utils/response.util");

module.exports = (req, res, next) => {
  const token = req.session?.token;
  if (!token) return sendError(res, 401, "Chưa đăng nhập");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (err) {
    return sendError(res, 401, "Token không hợp lệ hoặc đã hết hạn");
  }
};
