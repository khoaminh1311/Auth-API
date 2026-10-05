const authService = require('../services/authService');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký tài khoản người dùng mới
 * @access  Public
 */
const register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body || {};

  // 1. Validation cú pháp đầu vào tầng HTTP
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return next(new AppError('Họ và tên là bắt buộc và phải có ít nhất 2 ký tự', 400, 'Bad Request'));
  }

  if (name.trim().length > 50) {
    return next(new AppError('Họ và tên không được vượt quá 50 ký tự', 400, 'Bad Request'));
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return next(new AppError('Vui lòng cung cấp địa chỉ email hợp lệ', 400, 'Bad Request'));
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return next(new AppError('Mật khẩu phải có độ dài tối thiểu 8 ký tự', 400, 'Bad Request'));
  }

  if (password.length > 128) {
    return next(new AppError('Mật khẩu không được vượt quá 128 ký tự', 400, 'Bad Request'));
  }

  // 2. Gọi service xử lý nghiệp vụ
  const user = await authService.registerUser({ name, email, password });

  // 3. Trả về phản hồi HTTP
  res.status(201).json({
    message: 'Đăng ký tài khoản thành công',
    user,
  });
});

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập và nhận JWT
 * @access  Public
 */
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body || {};

  // 1. Validation cú pháp đầu vào tầng HTTP
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return next(new AppError('Vui lòng cung cấp đầy đủ email và mật khẩu', 400, 'Bad Request'));
  }

  // 2. Gọi service xử lý đăng nhập & cấp token
  const result = await authService.loginUser({ email, password });

  // 3. Trả về phản hồi HTTP
  res.status(200).json({
    message: 'Đăng nhập thành công',
    ...result,
  });
});

/**
 * @route   GET /api/auth/me
 * @desc    Lấy thông tin người dùng hiện tại
 * @access  Protected (authMiddleware)
 */
const getMe = (req, res) => {
  // req.user đã được authMiddleware gắn sẵn (safe object)
  res.status(200).json({
    message: 'Lấy thông tin người dùng thành công',
    user: req.user,
  });
};

/**
 * @route   PUT /api/auth/change-password
 * @desc    Đổi mật khẩu cho người dùng hiện tại
 * @access  Protected (authMiddleware)
 */
const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};

  // 1. Validation cú pháp đầu vào tầng HTTP
  if (!currentPassword || !newPassword) {
    return next(new AppError('Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới', 400, 'Bad Request'));
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return next(new AppError('Mật khẩu mới phải có độ dài tối thiểu 8 ký tự', 400, 'Bad Request'));
  }

  if (newPassword.length > 128) {
    return next(new AppError('Mật khẩu không được vượt quá 128 ký tự', 400, 'Bad Request'));
  }

  // 2. Gọi service thực hiện đổi mật khẩu
  await authService.changeUserPassword({
    userId: req.user.id,
    currentPassword,
    newPassword,
  });

  // 3. Trả về phản hồi HTTP
  res.status(200).json({
    message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại với mật khẩu mới',
  });
});

/**
 * @route   POST /api/auth/logout
 * @desc    Đăng xuất người dùng (Stateless JWT - hướng dẫn client xóa token)
 * @access  Protected (authMiddleware)
 */
const logout = (req, res) => {
  res.status(200).json({
    message: 'Đăng xuất thành công. Vui lòng xóa token phía client',
  });
};

module.exports = {
  register,
  login,
  getMe,
  changePassword,
  logout,
};
