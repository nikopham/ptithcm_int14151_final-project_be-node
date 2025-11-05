const bcrypt = require("bcryptjs");
const { prisma } = require("../config/db");
const { sendMail } = require("../utils/mailer");
const { sendSuccess, sendError } = require("../utils/response.util");
const { CUSTOMER } = require("../constants/actionTypes");

const generateCode = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
};

exports.registerController = async (req, res) => {
  const { action, payload } = req.body || {};

  // --- ACTION 1: SUBMIT INFO ---
  if (action === CUSTOMER.REGISTER_SUBMIT_INFO) {
    const { customerRegisterInfo } = payload || {};
    const { email, password, fullName } = customerRegisterInfo || {};

    if (!email || !password || !fullName) {
      return sendError(res, 400, "Thiếu thông tin đăng ký");
    }

    const existing = await prisma.account.findUnique({ where: { email } });
    if (existing) return sendError(res, 409, "Email đã tồn tại");

    const code = generateCode();
    const otp = await prisma.otpSession.create({
      data: {
        email,
        code,
        type: "register",
        expires_at: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    console.log(code);

    await sendMail({
      to: email,
      subject: "Xác thực đăng ký",
      html: `<p>Mã xác thực của bạn là: <b>${code}</b></p>`,
    });

    return sendSuccess(res, 200, "Đã gửi mã xác thực tới email", {
      otpSessionId: otp.id,
      customerRegisterInfo: { email, fullName, password },
    });
  }

  // --- ACTION 2: VERIFY CODE ---
  if (action === CUSTOMER.VERIFY_REGISTER_CODE) {
    const { otpSessionId, customerRegisterInfo, verifyCode } = payload || {};
    const { email, password, fullName } = customerRegisterInfo || {};

    if (
      otpSessionId == null ||
      !verifyCode ||
      !email ||
      !password ||
      !fullName
    ) {
      return sendError(res, 400, "Thiếu thông tin xác thực");
    }

    const id = parseInt(otpSessionId, 10);
    if (!Number.isInteger(id)) {
      return sendError(res, 400, "otpSessionId không hợp lệ");
    }

    const otp = await prisma.otpSession.findUnique({ where: { id } });
    if (!otp || otp.is_used || otp.type !== "register" || otp.email !== email) {
      return sendError(res, 400, "Mã xác thực không hợp lệ");
    }

    if (otp.expires_at < new Date()) {
      await prisma.otpSession.update({
        where: { id },
        data: { is_used: true },
      });
      return sendError(res, 410, "Mã xác thực đã hết hạn");
    }

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

    // Lấy role "viewer" (user loại thường)
    const viewerRole = await prisma.role.findUnique({
      where: { name: "viewer" },
    });
    if (!viewerRole) return sendError(res, 500, "Không tìm thấy role viewer");

    const hashed = await bcrypt.hash(String(password), 10);
    const account = await prisma.account.create({
      data: {
        email,
        password: hashed,
        role_id: viewerRole.id,
        full_name: fullName,
      },
    });

    await prisma.otpSession.update({ where: { id }, data: { is_used: true } });

    return sendSuccess(res, 201, "Đăng ký thành công", {
      accountId: account.id,
    });
  }

  return sendError(res, 400, "Action không hợp lệ");
};
