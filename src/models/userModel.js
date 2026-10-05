const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const config = require('../config/env');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng cung cấp họ và tên'],
      trim: true,
      minlength: [2, 'Họ và tên phải có ít nhất 2 ký tự'],
      maxlength: [50, 'Họ và tên không được vượt quá 50 ký tự'],
    },
    email: {
      type: String,
      required: [true, 'Vui lòng cung cấp địa chỉ email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Địa chỉ email không đúng định dạng',
      ],
    },
    password: {
      type: String,
      required: [true, 'Vui lòng cung cấp mật khẩu'],
      minlength: [8, 'Mật khẩu phải có độ dài tối thiểu 8 ký tự'],
      maxlength: [128, 'Mật khẩu không được vượt quá 128 ký tự'],
      select: false, // Không trả về password trong các truy vấn mặc định
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'admin'],
        message: 'Role người dùng chỉ có thể là user hoặc admin',
      },
      default: 'user',
    },
    passwordChangedAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: Băm mật khẩu bằng bcrypt trước khi lưu nếu mật khẩu thay đổi
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, config.bcrypt.saltRounds);

  // Nếu không phải tạo mới và mật khẩu đổi, cập nhật passwordChangedAt
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000; // Trừ 1s để tránh lệch timestamp với JWT
  }

  next();
});

// Instance method: Kiểm tra mật khẩu ứng viên với mật khẩu đã băm
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method: Kiểm tra xem mật khẩu có đổi sau thời điểm cấp token không
userSchema.methods.changedPasswordAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedTimestamp;
  }
  return false;
};

// Instance method: Chuyển đổi user thành dữ liệu an toàn (Safe User Projection)
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
