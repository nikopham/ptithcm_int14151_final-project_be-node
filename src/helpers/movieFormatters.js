// /src/helpers/movieFormatters.js (File mới)

// Helper 1: Định dạng phút (Int) -> "Xh Ym" (String)
exports.formatDuration = (minutes) => {
  if (!minutes || minutes <= 0) {
    return null;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

// Helper 2: Tính toán rating trung bình
exports.calculateAvgRating = (reviews) => {
  if (!reviews || reviews.length === 0) {
    return 0; // Hoặc null tùy bạn
  }
  const total = reviews.reduce((acc, review) => acc + review.rating, 0);
  const avg = total / reviews.length;
  // Làm tròn 1 chữ số
  return Math.round(avg * 10) / 10;
};
