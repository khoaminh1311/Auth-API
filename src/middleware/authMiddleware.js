const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/userModel');

/**
 * Middleware xác thực JWT Bearer token
 * - Đọc header Authorization
 * - Chỉ chấp nhận định dạng Bearer <token>
 * - Verify JWT; phân biệt token thiếu, sai, hết hạn
 * - Tìm user từ database theo ID trong token payload
 * - Từ chối token của user không còn tồn tại
 * - Từ chối token phát hành trước passwordChangedAt
 * - Gắn user an toàn vào req.user
 */
const authMiddleware = catchAsync(async (req, res, next) => {
  // 1. Lấy token từ header Authorization
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401, 'Unauthorized'));
  }

  if (!authHeader.startsWith('Bearer ')) {
    return next(new AppError('Định dạng token không hợp lệ. Sử dụng: Authorization: Bearer <token>', 401, 'Unauthorized'));
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401, 'Unauthorized'));
  }

  // 2. Xác minh token (phân biệt lỗi hết hạn và lỗi chữ ký sai)
  let decoded;
  try {
    decoded = await verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 401, 'Unauthorized'));
    }
    return next(new AppError('Token không hợp lệ hoặc đã hết hạn', 401, 'Unauthorized'));
  }

  // 3. Tìm user theo ID từ payload (lấy kèm passwordChangedAt để kiểm tra)
  const currentUser = await User.findById(decoded.id).select('+passwordChangedAt');

  // 4. Từ chối nếu user không còn tồn tại trong database
  if (!currentUser) {
    return next(new AppError('Tài khoản người dùng không còn tồn tại', 401, 'Unauthorized'));
  }

  // 5. Từ chối token phát hành trước lần đổi mật khẩu gần nhất
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại', 401, 'Unauthorized'));
  }

  // 6. Gắn user an toàn vào req.user (chỉ id, name, email, role)
  req.user = currentUser.toSafeObject();

  next();
});

module.exports = authMiddleware;
