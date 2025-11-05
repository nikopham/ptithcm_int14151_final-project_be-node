const { sendError } = require("../utils/response.util");

module.exports = (...allowedRoles) => {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!allowedRoles.includes(role)) {
      return sendError(res, 403, "Không có quyền truy cập");
    }
    next();
  };
};