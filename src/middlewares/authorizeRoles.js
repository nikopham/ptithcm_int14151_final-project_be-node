const { sendError } = require("../utils/response.util");

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return sendError(res, 401, "Chưa xác thực người dùng");
      }

      const userRoles = Array.isArray(req.user.role)
        ? req.user.role
        : [req.user.role];

      const isAllowed = userRoles.some((r) => allowedRoles.includes(r));
      if (!isAllowed) {
        return sendError(res, 403, "Bạn không có quyền truy cập");
      }

      return next();
    } catch (err) {
      console.error(err);
      return sendError(res, 500, "Lỗi kiểm tra phân quyền");
    }
  };
}

module.exports = authorizeRoles;
