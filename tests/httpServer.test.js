/**
 * ==============================================================================
 * Test Suite: HTTP Server Lifecycle & Admin Seed Idempotency
 * Mục tiêu: Kiểm tra vòng đời máy chủ HTTP và kịch bản khởi tạo Admin:
 *   1. Express app khởi động và lắng nghe thành công trên port.
 *   2. Server xử lý đóng kết nối sạch sẽ (Graceful Shutdown).
 *   3. Bắt lỗi xung đột cổng (EADDRINUSE) khi cổng đã bị chiếm.
 *   4. Script seedAdmin chạy lũy thoang (Idempotent):
 *      - Không tạo bản ghi trùng lặp khi chạy nhiều lần.
 *      - Đảm bảo tài khoản có role='admin'.
 *      - Mật khẩu admin được băm bằng bcrypt và so khớp chính xác.
 * ==============================================================================
 */

const assert = require('assert');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/env');
const connectDatabase = require('../src/config/database');
const User = require('../src/models/userModel');
const seedAdmin = require('../scripts/seedAdmin');

async function runHttpServerTests() {
  console.log('='.repeat(64));
  console.log('       TEST SUITE: HTTP SERVER LIFECYCLE & SEED ADMIN   ');
  console.log('='.repeat(64));

  let passed = 0;
  let total = 0;

  const test = async (name, fn) => {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
      process.exitCode = 1;
    }
  };

  try {
    // --------------------------------------------------------------------------
    // 1. Server Lifecycle: Khởi động và lắng nghe trên ephemeral port
    // --------------------------------------------------------------------------
    let testServer = null;
    let assignedPort = null;

    await test('HTTP server khởi động và lắng nghe thành công trên ephemeral port', async () => {
      testServer = http.createServer(app);
      await new Promise((resolve, reject) => {
        testServer.listen(0, '127.0.0.1', () => {
          assignedPort = testServer.address().port;
          resolve();
        });
        testServer.on('error', reject);
      });

      assert.ok(assignedPort > 0, 'Port phải là số nguyên dương hợp lệ');
      assert.strictEqual(testServer.listening, true, 'Server phải đang ở trạng thái listening');
    });

    // --------------------------------------------------------------------------
    // 2. Server Lifecycle: Xung đột cổng (EADDRINUSE)
    // --------------------------------------------------------------------------
    await test('HTTP server ném lỗi EADDRINUSE khi cổng đã bị chiếm dụng', async () => {
      const conflictingServer = http.createServer(app);
      await assert.rejects(
        () =>
          new Promise((resolve, reject) => {
            conflictingServer.listen(assignedPort, '127.0.0.1', () => {
              conflictingServer.close();
              resolve();
            });
            conflictingServer.on('error', reject);
          }),
        (err) => {
          assert.strictEqual(err.code, 'EADDRINUSE');
          return true;
        }
      );
    });

    // --------------------------------------------------------------------------
    // 3. Server Lifecycle: Graceful shutdown
    // --------------------------------------------------------------------------
    await test('HTTP server đóng kết nối thành công và giải phóng cổng', async () => {
      await new Promise((resolve, reject) => {
        testServer.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      assert.strictEqual(testServer.listening, false, 'Server phải kết thúc lắng nghe sau khi close');
    });

    // --------------------------------------------------------------------------
    // 4. Admin Seed Idempotency & Role Verification
    // --------------------------------------------------------------------------
    await test('seedAdmin đảm bảo tính lũy thoang (idempotency) và gán đúng role="admin"', async () => {
      // Chạy seed admin lần 1
      await seedAdmin();

      // Kết nối DB để kiểm tra
      await connectDatabase(config.mongodbUri);
      const adminEmail = config.admin.email.toLowerCase().trim();

      const count1 = await User.countDocuments({ email: adminEmail });
      assert.strictEqual(count1, 1, 'Chỉ được phép có duy nhất 1 tài khoản admin');

      const adminUser1 = await User.findOne({ email: adminEmail }).select('+password');
      assert.ok(adminUser1, 'Admin user phải tồn tại');
      assert.strictEqual(adminUser1.role, 'admin', 'Role của tài khoản phải là admin');

      const passwordMatches = await adminUser1.comparePassword(config.admin.password);
      assert.strictEqual(passwordMatches, true, 'Mật khẩu admin băm bằng bcrypt phải so khớp đúng');

      // Chạy seed admin lần 2 (kiểm tra tính lũy thoang)
      await seedAdmin();

      // Kết nối lại sau khi seedAdmin ngắt kết nối
      await connectDatabase(config.mongodbUri);
      const count2 = await User.countDocuments({ email: adminEmail });
      assert.strictEqual(count2, 1, 'Sau khi chạy lại seedAdmin, số lượng admin vẫn phải là 1 (không tạo trùng)');
    });

  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }

  console.log(`\n[KẾT QUẢ HTTP SERVER TESTS]: ${passed}/${total} PASS\n`);
  return { passed, total };
}

if (require.main === module) {
  runHttpServerTests().catch((err) => {
    console.error('Lỗi ngoại lệ trong test suite:', err);
    process.exit(1);
  });
}

module.exports = runHttpServerTests;
