const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB/file
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpe?g|png|webp|gif)$/i.test(file.mimetype);
    if (!ok) return cb(new Error("Định dạng ảnh không hợp lệ"), false);
    cb(null, true);
  },
});

module.exports = upload;
