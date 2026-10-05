const User = require('../models/userModel');
const AppError = require('../utils/appError');
const { generateToken } = require('../utils/jwt');
const config = require('../config/env');

/**
 * Đăng ký tài khoản người dùng mới
 * @param {Object} userData - { name, email, password }
 * @returns {Promise<Object>} Safe user object
 */
const registerUser = async ({ name, email, password }) => {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Kiểm tra email đã được đăng ký chưa
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('Email đã được sử dụng', 409, 'Conflict');
  }

  // 2. Tạo user mới (password sẽ được hash tự động qua pre-save hook)
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
  });

  return user.toSafeObject();
};

/**
 * Xác thực thông tin đăng nhập và cấp JWT token
 * @param {Object} credentials - { email, password }
 * @returns {Promise<Object>} { user, token, expiresIn }
 */
const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Tìm user kèm mật khẩu đã băm
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  // 2. So sánh mật khẩu (thông báo chung chống user enumeration)
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Email hoặc mật khẩu không đúng', 401, 'Unauthorized');
  }

  // 3. Tạo JWT token
  const token = generateToken(user._id);

  return {
    user: user.toSafeObject(),
    token,
    expiresIn: config.jwt.expiresIn,
  };
};

/**
 * Đổi mật khẩu cho người dùng hiện tại
 * @param {Object} param - { userId, currentPassword, newPassword }
 * @returns {Promise<void>}
 */
const changeUserPassword = async ({ userId, currentPassword, newPassword }) => {
  // 1. Lấy thông tin user kèm mật khẩu hiện tại
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new AppError('Tài khoản người dùng không còn tồn tại', 401, 'Unauthorized');
  }

  // 2. Xác minh mật khẩu hiện tại
  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Mật khẩu hiện tại không đúng', 401, 'Unauthorized');
  }

  // 3. Kiểm tra mật khẩu mới không được trùng mật khẩu cũ
  if (await user.comparePassword(newPassword)) {
    throw new AppError('Mật khẩu mới không được trùng với mật khẩu hiện tại', 400, 'Bad Request');
  }

  // 4. Cập nhật mật khẩu mới (pre-save hook tự động băm và gán passwordChangedAt)
  user.password = newPassword;
  await user.save();
};

module.exports = {
  registerUser,
  loginUser,
  changeUserPassword,
};
