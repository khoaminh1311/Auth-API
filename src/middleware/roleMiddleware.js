const AppError = require('../utils/appError');

/**
 * Middleware phân quyền người dùng (Role-Based Access Control - RBAC)
 * Chạy sau authMiddleware (yêu cầu req.user đã tồn tại)
 * 
 * @param {...string} roles - Danh sách các quyền được phép truy cập (vd: 'admin', 'user')
 * @returns {Function} Express middleware function
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    // 1. Kiểm tra xem user đã được xác thực trước đó qua authMiddleware hay chưa
    if (!req.user) {
      return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401, 'Unauthorized'));
    }

    // 2. Kiểm tra xem role của user có nằm trong danh sách được cấp quyền hay không
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Bạn không có quyền thực hiện hành động này', 403, 'Forbidden')
      );
    }

    next();
  };
};

module.exports = {
  authorizeRoles,
};
