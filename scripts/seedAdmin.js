const mongoose = require('mongoose');
const config = require('../src/config/env');
const connectDatabase = require('../src/config/database');
const User = require('../src/models/userModel');

/**
 * Script khởi tạo tài khoản quản trị viên (Admin Bootstrap / Seed)
 * - Đọc thông tin ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD từ .env
 * - Validate chặt chẽ các biến bắt buộc
 * - Tạo admin nếu chưa tồn tại; Nâng quyền lên admin nếu email đã tồn tại (Idempotent)
 * - Mật khẩu tự động băm an toàn qua bcrypt (pre-save hook)
 * - Tuyệt đối không log mật khẩu plaintext hoặc hash ra console
 */
const seedAdmin = async () => {
  const { name, email, password } = config.admin || {};

  // 1. Kiểm tra các biến môi trường bắt buộc
  if (!name || !email || !password) {
    console.error('[FATAL] Thiếu thông tin cấu hình admin (ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD) trong file .env');
    console.error('[FATAL] Script seed admin bị hủy để đảm bảo an toàn.');
    process.exit(1);
  }

  if (typeof password !== 'string' || password.length < 8) {
    console.error('[FATAL] ADMIN_PASSWORD trong file .env phải có độ dài tối thiểu 8 ký tự.');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // 2. Kết nối database
    await connectDatabase(config.mongodbUri);
    console.log('[INFO] Đang kiểm tra tài khoản quản trị viên...');

    // 3. Tìm kiếm xem tài khoản đã tồn tại hay chưa
    let user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      // 3a. Chưa tồn tại -> Tạo mới admin (pre-save hook tự động băm mật khẩu)
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: 'admin',
      });
      console.log(`[SUCCESS] Đã tạo thành công tài khoản quản trị viên mới: ${normalizedEmail} (Role: admin)`);
    } else {
      // 3b. Đã tồn tại -> Cập nhật role thành admin (Idempotent)
      user.name = name.trim();
      user.role = 'admin';
      user.password = password; // Sẽ được băm lại qua hook pre('save')
      await user.save();
      console.log(`[SUCCESS] Tài khoản ${normalizedEmail} đã tồn tại. Đã đảm bảo role là 'admin' và đồng bộ thông tin (Idempotent).`);
    }

    console.log('[INFO] Quá trình seed admin hoàn tất an toàn (Không in mật khẩu ra log).');
  } catch (error) {
    console.error(`[ERROR] Quá trình seed admin thất bại: ${error.message}`);
    process.exit(1);
  } finally {
    // 4. Luôn ngắt kết nối database sạch sẽ
    await mongoose.disconnect();
    console.log('[INFO] Đã đóng kết nối database.');
  }
};

// Tự động chạy khi gọi trực tiếp từ CLI (vd: npm run seed:admin)
if (require.main === module) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedAdmin;
