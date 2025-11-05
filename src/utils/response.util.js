exports.sendSuccess = (res, code = 200, message = "Thành công", data = {}) => {
  return res.status(code).json({
    success: true,
    code,
    message,
    data,
  });
};

exports.sendError = (res, code = 500, message = "Đã xảy ra lỗi", data = {}) => {
  return res.status(code).json({
    success: false,
    code,
    message,
    data,
  });
};
