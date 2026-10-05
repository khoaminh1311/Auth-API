const config = require('../src/config/env');
const connectDatabase = require('../src/config/database');

const seedAdmin = async () => {
  const { name, email, password } = config.admin;

  if (!name || !email || !password) {
    console.error('[ERROR] Thiếu thông tin cấu hình admin (ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD) trong file .env');
    process.exit(1);
  }

  try {
    await connectDatabase(config.mongodbUri);
    console.log('[INFO] Đang chuẩn bị seed tài khoản admin...');
    // Seed logic sẽ được hoàn thiện trong Phase 6 khi User model sẵn sàng
    console.log('[INFO] Kiểm tra kết nối và cấu hình admin hoàn tất.');
    process.exit(0);
  } catch (error) {
    console.error('[ERROR] Lỗi khi chạy seed admin:', error.message);
    process.exit(1);
  }
};

seedAdmin();
