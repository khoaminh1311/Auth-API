const User = require('../models/userModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { generateToken } = require('../utils/jwt');
const { formatSafeUser } = require('../utils/userResponse');
const config = require('../config/env');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký tài khoản người dùng mới
 * @access  Public
 */
const register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  // 1. Validation đầu vào
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

  const normalizedEmail = email.toLowerCase().trim();
  const trimmedName = name.trim();

  // 2. Kiểm tra email đã tồn tại hay chưa
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return next(new AppError('Email đã được sử dụng', 409, 'Conflict'));
  }

  // 3. Tạo user mới (Bỏ qua bất kỳ trường role nào client gửi lên, luôn gán 'user')
  const newUser = await User.create({
    name: trimmedName,
    email: normalizedEmail,
    password,
    role: 'user',
  });

  // 4. Trả về phản hồi an toàn
  res.status(201).json({
    message: 'Đăng ký tài khoản thành công',
    user: formatSafeUser(newUser),
  });
});

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập và nhận JWT
 * @access  Public
 */
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1. Validation đầu vào
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return next(new AppError('Vui lòng cung cấp đầy đủ email và mật khẩu', 400, 'Bad Request'));
  }

  const normalizedEmail = email.toLowerCase().trim();

  // 2. Tìm user theo email (lấy kèm trường password)
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  // 3. So sánh password (Dùng thông điệp chung để chống user enumeration)
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Email hoặc mật khẩu không đúng', 401, 'Unauthorized'));
  }

  // 4. Tạo JWT token
  const token = generateToken(user._id);

  // 5. Trả về thông tin đăng nhập thành công
  res.status(200).json({
    message: 'Đăng nhập thành công',
    user: formatSafeUser(user),
    token,
    expiresIn: config.jwt.expiresIn,
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

  // 1. Kiểm tra đầu vào bắt buộc
  if (!currentPassword || !newPassword) {
    return next(new AppError('Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới', 400, 'Bad Request'));
  }

  // 2. Kiểm tra độ dài mật khẩu mới
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return next(new AppError('Mật khẩu mới phải có độ dài tối thiểu 8 ký tự', 400, 'Bad Request'));
  }

  if (newPassword.length > 128) {
    return next(new AppError('Mật khẩu không được vượt quá 128 ký tự', 400, 'Bad Request'));
  }

  // 3. Lấy thông tin user cùng với mật khẩu đã băm
  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    return next(new AppError('Tài khoản người dùng không còn tồn tại', 401, 'Unauthorized'));
  }

  // 4. Kiểm tra mật khẩu hiện tại
  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Mật khẩu hiện tại không đúng', 401, 'Unauthorized'));
  }

  // 5. Kiểm tra mật khẩu mới không được trùng mật khẩu hiện tại
  if (await user.comparePassword(newPassword)) {
    return next(new AppError('Mật khẩu mới không được trùng với mật khẩu hiện tại', 400, 'Bad Request'));
  }

  // 6. Cập nhật mật khẩu mới (pre-save hook sẽ tự động băm và set passwordChangedAt)
  user.password = newPassword;
  await user.save();

  // 7. Trả về thông báo thành công theo API contract
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
