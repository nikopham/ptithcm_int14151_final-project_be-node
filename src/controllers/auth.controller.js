const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { prisma } = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response.util");

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const ip = req.ip;
  const userAgent = req.headers["user-agent"];

  try {
    const account = await prisma.account.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!account) return sendError(res, 401, "Email hoặc mật khẩu không đúng");

    // Schema hiện tại không có trường status, nên bỏ qua kiểm tra 'inactive'

    const isMatch = await bcrypt.compare(
      String(password || ""),
      account.password
    );
    if (!isMatch) return sendError(res, 401, "Email hoặc mật khẩu không đúng");

    const accessToken = jwt.sign(
      { id: account.id, role: account.role?.name || null },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    if (req.session) {
      req.session.token = accessToken;
    }

    // Thiết lập refresh token JWT và lưu vào DB
    const days = parseInt(process.env.REFRESH_TOKEN_EXPIRE, 10);
    const refreshDays = Number.isFinite(days) ? days : 7;
    const refreshToken = jwt.sign({ id: account.id }, process.env.JWT_SECRET, {
      expiresIn: `${refreshDays}d`,
    });

    await prisma.refreshToken.create({
      data: {
        account_id: account.id,
        token: refreshToken,
        expires_at: new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000),
        // Schema hiện tại không có ip_address/user_agent nên không lưu các trường này
      },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: refreshDays * 24 * 60 * 60 * 1000,
    });

    return sendSuccess(res, 200, "Đăng nhập thành công", {
      account: {
        id: account.id,
        email: account.email,
        role: account.role?.name || null,
      },
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi máy chủ khi đăng nhập");
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const tokenRecord = req.tokenRecord;
    if (!tokenRecord)
      return sendError(res, 401, "Thiếu thông tin refresh token");

    const account = await prisma.account.findUnique({
      where: { id: tokenRecord.account_id },
      include: { role: true },
    });
    if (!account) return sendError(res, 404, "Tài khoản không tồn tại");

    const newAccessToken = jwt.sign(
      { id: account.id, role: account.role?.name || null },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    if (req.session) {
      req.session.token = newAccessToken;
    }

    return sendSuccess(res, 200, "Làm mới access token thành công", {});
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi server khi làm mới token");
  }
};

exports.logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      // token không unique trong schema hiện tại, dùng updateMany
      await prisma.refreshToken.updateMany({
        where: { token, revoked: false },
        data: { revoked: true },
      });
      res.clearCookie("refreshToken");
    }

    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        return sendSuccess(res, 200, "Đăng xuất thành công");
      });
    } else {
      return sendSuccess(res, 200, "Đăng xuất thành công");
    }
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi server khi đăng xuất");
  }
};

exports.logoutAll = async (req, res) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { account_id: req.user.id, revoked: false },
      data: { revoked: true },
    });

    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.clearCookie("refreshToken");
        return sendSuccess(res, 200, "Đăng xuất khỏi tất cả thiết bị");
      });
    } else {
      res.clearCookie("refreshToken");
      return sendSuccess(res, 200, "Đăng xuất khỏi tất cả thiết bị");
    }
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi máy chủ khi logout-all");
  }
};

exports.me = async (req, res) => {
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.user.id },
      include: { role: true },
    });
    if (!account) return sendError(res, 404, "Không tìm thấy tài khoản");

    return sendSuccess(res, 200, "Lấy thông tin người dùng thành công", {
      id: account.id,
      email: account.email,
      role: account.role?.name || null,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi server khi lấy thông tin người dùng");
  }
};

exports.updateAccountStatus = async (req, res) => {
  try {
    const { accountId, status } = req.body;

    if (accountId == null || !status)
      return sendError(res, 400, "Thiếu accountId hoặc status");

    const allowed = ["active", "inactive"];
    if (!allowed.includes(status))
      return sendError(res, 400, "Giá trị status không hợp lệ");

    const id = Number(accountId);
    if (!Number.isInteger(id))
      return sendError(res, 400, "accountId không hợp lệ");

    const updated = await prisma.account.update({
      where: { id },
      data: { status },
      include: { role: true },
    });

    return sendSuccess(res, 200, "Cập nhật trạng thái tài khoản thành công", {
      account: {
        id: updated.id,
        email: updated.email,
        status: updated.status,
        role: updated.role?.name || null,
      },
    });
  } catch (err) {
    if (err?.code === "P2025") {
      return sendError(res, 404, "Không tìm thấy tài khoản");
    }
    console.error(err);
    return sendError(res, 500, "Lỗi máy chủ khi cập nhật trạng thái tài khoản");
  }
};

exports.changePasswordByAccountId = async (req, res) => {
  try {
    const paramId = req.params.accountId;
    const { old_password, new_password, force = false } = req.body || {};

    const accountId = parseInt(paramId, 10);
    if (!Number.isInteger(accountId)) {
      return sendError(res, 400, "account_id không hợp lệ");
    }

    const isAdmin = req.user?.role === "admin";
    const isOwner = Number(req.user?.id) === Number(accountId);

    if (!isOwner) {
      return sendError(
        res,
        403,
        "Bạn không có quyền đổi mật khẩu tài khoản này"
      );
    }
    if (force && !isAdmin) {
      return sendError(res, 400, "Chỉ admin mới được phép force đổi mật khẩu");
    }

    // Validate input
    if (!new_password || String(new_password).length < 8) {
      return sendError(res, 400, "Mật khẩu mới phải tối thiểu 8 ký tự");
    }
    if (!force && !old_password) {
      return sendError(res, 400, "Vui lòng nhập mật khẩu hiện tại");
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) return sendError(res, 404, "Không tìm thấy tài khoản");

    if (!force) {
      const ok = await bcrypt.compare(
        String(old_password || ""),
        account.password
      );
      if (!ok) return sendError(res, 400, "Mật khẩu hiện tại không chính xác");
    }

    // Hash & cập nhật
    const hashed = await bcrypt.hash(String(new_password), 12);
    await prisma.account.update({
      where: { id: accountId },
      data: { password: hashed },
    });

    // Thu hồi toàn bộ refresh token còn hiệu lực
    await prisma.refreshToken.updateMany({
      where: { account_id: accountId, revoked: false },
      data: { revoked: true },
    });

    return sendSuccess(res, 200, "Đổi mật khẩu thành công", {
      account_id: accountId,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi server khi đổi mật khẩu");
  }
};
