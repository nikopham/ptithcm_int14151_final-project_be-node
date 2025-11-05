const { prisma } = require("../config/db");
const { sendSuccess, sendError } = require("../utils/response.util");
const bcrypt = require("bcryptjs");

exports.getAccountByAccountId = async (req, res) => {
  try {
    const { accountId } = req.params;

    const accountIdNumber = Number(accountId);
    if (isNaN(accountIdNumber) || accountIdNumber < 1) {
      return sendError(res, 400, "account_id không hợp lệ");
    }

    // Lấy thông tin cơ bản từ Account (chỉ các trường đã xác nhận có trong schema)
    const customer = await prisma.account.findUnique({
      where: { id: accountIdNumber },
      select: {
        id: true,
        email: true,
        full_name: true,
        avatar_url: true, // Giả định avatar_url có
        created_at: true,
        status: true,
      },
    });

    if (!customer) {
      return sendError(res, 404, "Không tìm thấy tài khoản");
    }

    return sendSuccess(res, 200, "Lấy thông tin tài khoản thành công", {
      customer,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi server khi lấy thông tin tài khoản");
  }
};

exports.updateAccountByAccountId = async (req, res) => {
  try {
    const { accountId } = req.params;
    const accountIdNumber = Number(accountId);

    if (isNaN(accountIdNumber) || accountIdNumber < 1) {
      return sendError(res, 400, "account_id không hợp lệ");
    }

    // Quyền: Chỉ chính chủ được sửa
    const isOwner = Number(req.user?.id) === accountIdNumber;
    if (!isOwner) {
      return sendError(res, 403, "Bạn không có quyền cập nhật hồ sơ này");
    }

    // Chỉ lấy full_name từ body, bỏ qua dob, phone, address, gender
    const { full_name } = req.body || {};
    const toSet = {};

    // 1. full_name
    if (typeof full_name !== "undefined") {
      const name = String(full_name || "").trim();
      if (!name) return sendError(res, 400, "full_name không được để trống");
      if (name.length > 255)
        return sendError(res, 400, "full_name tối đa 255 ký tự");
      toSet.full_name = name;
    }

    if (Object.keys(toSet).length === 0) {
      return sendError(res, 400, "Không có dữ liệu để cập nhật");
    }

    // 2. Thực hiện cập nhật Prisma
    const updated = await prisma.account.update({
      where: { id: accountIdNumber },
      data: toSet,
      select: {
        id: true,
        email: true,
        full_name: true,
        avatar_url: true,
        created_at: true,
        status: true,
      },
    });

    return sendSuccess(res, 200, "Cập nhật thông tin tài khoản thành công", {
      customer: updated,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi server khi cập nhật tài khoản");
  }
};

exports.changePasswordByAccountId = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { old_password, new_password, force = false } = req.body || {};

    const accountIdNumber = Number(accountId);

    // 1. Kiểm tra ID không hợp lệ (Kiểm tra kiểu số)
    if (isNaN(accountIdNumber) || accountIdNumber < 1) {
      return sendError(res, 400, "account_id không hợp lệ");
    }

    // 2. Kiểm tra quyền hạn
    const isAdmin = req.user?.role === "admin";
    const isOwner = Number(req.user?.id) === accountIdNumber;

    // Nếu không phải chính chủ
    if (!isOwner) {
      return sendError(
        res,
        403,
        "Bạn không có quyền đổi mật khẩu tài khoản này"
      );
    }

    // Nếu không phải admin nhưng cố gắng dùng force
    if (!isAdmin && force) {
      return sendError(res, 403, "Chỉ admin mới được phép force đổi mật khẩu");
    }

    // 3. Validate input
    if (!new_password || String(new_password).length < 8) {
      return sendError(res, 400, "Mật khẩu mới phải tối thiểu 8 ký tự");
    }
    if (!force && !old_password) {
      return sendError(res, 400, "Vui lòng nhập mật khẩu hiện tại");
    }

    // 4. Tìm tài khoản
    const account = await prisma.account.findUnique({
      where: { id: accountIdNumber },
    });
    if (!account) return sendError(res, 404, "Không tìm thấy tài khoản");

    // 5. Xác thực mật khẩu cũ (Nếu không phải force)
    if (!force) {
      const ok = await bcrypt.compare(String(old_password), account.password);
      if (!ok) return sendError(res, 400, "Mật khẩu hiện tại không chính xác");
    }

    // 6. Hash mật khẩu mới
    const hashed = await bcrypt.hash(String(new_password), 12);

    // 7. Cập nhật mật khẩu trong CSDL
    await prisma.account.update({
      where: { id: accountIdNumber },
      data: {
        password: hashed,
        // (Bỏ qua password_changed_at vì không có trong schema gốc)
      },
    });

    // 8. Vô hiệu hóa Refresh Token
    // (Đảm bảo model RefreshToken có trường 'revoked: Boolean')
    await prisma.refreshToken.updateMany({
      where: {
        account_id: accountIdNumber,
        revoked: false, // Chỉ vô hiệu hóa các token đang hoạt động
      },
      data: {
        revoked: true,
        // (Bỏ qua revoked_reason, revoked_at nếu không có trong schema)
      },
    });

    return sendSuccess(res, 200, "Đổi mật khẩu thành công", {
      account_id: accountIdNumber,
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, "Lỗi server khi đổi mật khẩu");
  }
};