const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { prisma } = require("../config/db");
const { sendMail } = require("../utils/mailer");
const { sendSuccess, sendError } = require("../utils/response.util");
const { CUSTOMER } = require("../constants/actionTypes");

const generateCode = () => crypto.randomBytes(3).toString("hex"); // 6 ký tự
const generatePassword = () => crypto.randomBytes(4).toString("hex"); // 8 ký tự

exports.resetPwController = async (req, res) => {
  const { action, payload } = req.body || {};

  /* ───────── ACTION 1: SUBMIT EMAIL ───────── */
  if (action === CUSTOMER.RESET_PW_SUBMIT_INFO) {
    const { email } = payload || {};
    if (!email) return sendError(res, 400, "Thiếu email");

    const account = await prisma.account.findUnique({ where: { email } });
    if (!account) return sendError(res, 404, "Email không tồn tại");

    // Tạo OTP session
    const code = generateCode();
    const otp = await prisma.otpSession.create({
      data: {
        email,
        code,
        type: "reset_pw",
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // Gửi mail
    await sendMail({
      to: email,
      subject: "Mã xác thực đặt lại mật khẩu",
      html: `<p>Mã xác thực của bạn là: <b>${code}</b></p>`,
    });

    return sendSuccess(res, 200, "Đã gửi mã xác thực tới email", {
      otpSessionId: otp.id,
    });
  }

  /* ───────── ACTION 2: VERIFY CODE ───────── */
  if (action === CUSTOMER.VERIFY_RESET_PW_CODE) {
    const { otpSessionId, verifyCode } = payload || {};
    if (otpSessionId == null || !verifyCode)
      return sendError(res, 400, "Thiếu thông tin xác thực");

    const id = parseInt(otpSessionId, 10);
    if (!Number.isInteger(id))
      return sendError(res, 400, "otpSessionId không hợp lệ");

    const otp = await prisma.otpSession.findUnique({ where: { id } });
    if (!otp) return sendError(res, 400, "Mã xác thực không hợp lệ");

    if (otp.attempt >= 5) {
      return sendError(
        res,
        429,
        "Bạn đã nhập sai mã quá 5 lần. Vui lòng đăng ký lại.",
        { retryRequired: true }
      );
    }

    if (otp.is_used || otp.type !== "reset_pw")
      return sendError(res, 400, "Mã xác thực không hợp lệ");

    if (otp.code !== verifyCode) {
      const updated = await prisma.otpSession.update({
        where: { id },
        data: { attempt: { increment: 1 } },
      });
      if (updated.attempt >= 5) {
        await prisma.otpSession.update({
          where: { id },
          data: { is_used: true },
        });
        return sendError(
          res,
          429,
          "Bạn đã nhập sai mã quá 5 lần. Vui lòng đăng ký lại.",
          { retryRequired: true }
        );
      }

      return sendError(res, 400, "Mã xác thực không đúng", {
        attempt: updated.attempt,
      });
    }

    if (otp.expires_at < new Date()) {
      await prisma.otpSession.update({
        where: { id },
        data: { is_used: true },
      });
      return sendError(res, 410, "Mã xác thực đã hết hạn");
    }

    // Cấp mật khẩu mới
    const newPlainPw = generatePassword();
    const hashed = await bcrypt.hash(newPlainPw, 10);

    const account = await prisma.account.findUnique({
      where: { email: otp.email },
    });
    if (!account) return sendError(res, 404, "Không tìm thấy tài khoản");

    await prisma.account.update({
      where: { id: account.id },
      data: { password: hashed },
    });

    // Thu hồi toàn bộ refresh token còn hiệu lực
    await prisma.refreshToken.updateMany({
      where: { account_id: account.id, revoked: false },
      data: { revoked: true },
    });

    // Đánh dấu OTP đã dùng
    await prisma.otpSession.update({ where: { id }, data: { is_used: true } });
    console.log(newPlainPw);
    
    // Gửi mật khẩu mới tới email
    await sendMail({
      to: otp.email,
      subject: "Mật khẩu mới tài khoản",
      html: `<p>Mật khẩu mới của bạn là: <b>${newPlainPw}</b></p>`,
    });

    return sendSuccess(
      res,
      200,
      "Đặt lại mật khẩu thành công. Mật khẩu mới đã được gửi tới email.",
      {}
    );
  }

  /* ───────── Action không hợp lệ ───────── */
  return sendError(res, 400, "Action không hợp lệ");
};
