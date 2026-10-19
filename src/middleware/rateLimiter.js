const rateLimit = require('express-rate-limit');
const config = require('../config/env');

/**
 * Middleware giới hạn tần suất gửi yêu cầu cho các endpoint xác thực (Brute-Force & DoS Protection)
 * - Mặc định: Tối đa 20 requests / 15 phút trên mỗi IP đối với môi trường dev / production
 * - Môi trường test: Cho phép hạn mức lớn (1000 requests) để không làm gián đoạn test suite tự động
 * - Phản hồi chuẩn hợp đồng: { message, error, statusCode: 429 }
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: config.nodeEnv === 'test' ? 1000 : 20,
  standardHeaders: true, // Trả về RateLimit-* headers chuẩn IETF
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      message: 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
      error: 'Too Many Requests',
      statusCode: 429,
    });
  },
});

module.exports = {
  authLimiter,
};
