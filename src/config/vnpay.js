// utils/vnpay.js
const crypto = require("crypto");
const qs = require("qs");

function sortObject(obj) {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => (sorted[k] = obj[k]));
  return sorted;
}

function hmacSHA512(secret, data) {
  return crypto
    .createHmac("sha512", secret)
    .update(data, "utf-8")
    .digest("hex");
}

exports.buildVNPayPaymentUrl = ({
  amountVnd, // số tiền (VND) - chưa *100
  orderId, // dùng booking_code hoặc 1 mã duy nhất
  orderInfo, // mô tả hiển thị trên VNPay
  ipAddr,
}) => {
  const vnp_Url = process.env.VNP_PAYMENT_URL;
  const vnp_TmnCode = process.env.VNP_TMNCODE;
  const vnp_HashSecret = process.env.VNP_HASHSECRET;
  const vnp_ReturnUrl = process.env.VNP_RETURN_URL;
  const vnp_IpnUrl = process.env.VNP_IPN_URL;
  const vnp_Locale = process.env.VNP_LOCALE || "vn";

  const createDate = new Date();
  const pad2 = (n) => n.toString().padStart(2, "0");
  const y = createDate.getFullYear();
  const m = pad2(createDate.getMonth() + 1);
  const d = pad2(createDate.getDate());
  const hh = pad2(createDate.getHours());
  const mm = pad2(createDate.getMinutes());
  const ss = pad2(createDate.getSeconds());
  const vnp_CreateDate = `${y}${m}${d}${hh}${mm}${ss}`;

  // VNPay yêu cầu amount * 100
  const vnp_Amount = Math.round(Number(amountVnd || 0) * 100);

  let vnp_Params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode,
    vnp_Locale,
    vnp_CurrCode: "VND",
    vnp_TxnRef: String(orderId),
    vnp_OrderInfo: String(orderInfo || `Thanh toan don hang ${orderId}`),
    vnp_OrderType: "other",
    vnp_Amount,
    vnp_ReturnUrl,
    vnp_IpAddr: ipAddr || "0.0.0.0",
    vnp_CreateDate,
    vnp_ExpireDate: undefined, // có thể thêm +15 phút nếu muốn
    vnp_IpnUrl, // khuyến nghị gửi thêm (một số tài liệu cũ không yêu cầu)
  };

  // bỏ undefined
  Object.keys(vnp_Params).forEach(
    (k) => vnp_Params[k] == null && delete vnp_Params[k]
  );

  vnp_Params = sortObject(vnp_Params);
  const signData = qs.stringify(vnp_Params, { encode: false });
  const secureHash = hmacSHA512(vnp_HashSecret, signData);
  const payUrl = `${vnp_Url}?${signData}&vnp_SecureHash=${secureHash}`;

  return { payUrl, vnp_Params, secureHash };
};

exports.verifyVNPaySignature = (params) => {
  const vnp_HashSecret = process.env.VNP_HASHSECRET;
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = params;
  const sorted = Object.keys(rest)
    .sort()
    .reduce((acc, k) => {
      acc[k] = rest[k];
      return acc;
    }, {});
  const signData = qs.stringify(sorted, { encode: false });
  const checkHash = hmacSHA512(vnp_HashSecret, signData);
  return checkHash === vnp_SecureHash;
};
