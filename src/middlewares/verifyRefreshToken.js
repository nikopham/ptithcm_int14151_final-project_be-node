const { prisma } = require("../config/db");
const jwt = require("jsonwebtoken");
const { sendError } = require("../utils/response.util");

module.exports = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return sendError(res, 401, "Thiếu refresh token");
    }

    // Xác minh JWT
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Token không phải unique => dùng findFirst
    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        revoked: false,
      },
    });

    if (!tokenRecord || tokenRecord.expires_at < new Date()) {
      return sendError(res, 401, "Refresh token không hợp lệ hoặc đã hết hạn");
    }

    // Đảm bảo token thuộc về đúng user trong payload (nếu payload có id)
    if (payload?.id && payload.id !== tokenRecord.account_id) {
      return sendError(res, 401, "Refresh token không hợp lệ");
    }

    req.tokenRecord = tokenRecord;
    req.user = { id: tokenRecord.account_id };
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return sendError(res, 401, "Refresh token không hợp lệ");
    }
    console.error("Lỗi xác minh refresh token:", err);
    return sendError(res, 500, "Lỗi máy chủ nội bộ");
  }
};
