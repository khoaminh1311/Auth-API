/**
 * ==============================================================================
 * Test Suite: Auth Service (Tầng Nghiệp vụ Xác thực & Người dùng)
 * Mục tiêu: Kiểm tra toàn bộ logic nghiệp vụ của authService.js:
 *   1. registerUser: tạo user, chuẩn hóa email, từ chối trùng lặp (409 Conflict).
 *   2. loginUser: xác thực email/password, cấp JWT hợp lệ, chống user enumeration (401).
 *   3. changeUserPassword: kiểm tra mật khẩu hiện tại, chống trùng mật khẩu cũ (400),
 *      cập nhật mật khẩu mới và kiểm tra passwordChangedAt.
 * ==============================================================================
 */

const assert = require('assert');
const mongoose = require('mongoose');
const config = require('../src/config/env');
const User = require('../src/models/userModel');
const authService = require('../src/services/authService');
const { verifyToken } = require('../src/utils/jwt');
const connectDatabase = require('../src/config/database');
const AppError = require('../src/utils/appError');

const TEST_EMAIL_PREFIX = `test_service_${Date.now()}`;

async function runAuthServiceTests() {
  console.log('='.repeat(64));
  console.log('       TEST SUITE: AUTH SERVICE (BUSINESS LOGIC)       ');
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

  // Đảm bảo kết nối MongoDB
  let ownConnection = false;
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase(config.mongodbUri);
    ownConnection = true;
  }

  // Dọn dẹp dữ liệu test cũ nếu có
  await User.deleteMany({ email: new RegExp(`^${TEST_EMAIL_PREFIX}`) });

  const testUserEmail = `${TEST_EMAIL_PREFIX}@example.com`;
  const rawPassword = 'InitialPassword123!';
  const updatedPassword = 'NewPassword456!';
  let createdUserId = null;

  try {
    // --------------------------------------------------------------------------
    // 1. registerUser: Thành công
    // --------------------------------------------------------------------------
    await test('registerUser thành công: trả về safe object, role="user", không lộ password', async () => {
      const result = await authService.registerUser({
        name: 'Nguyen Van Test',
        email: `  ${testUserEmail.toUpperCase()}  `, // Test trim & lowercase
        password: rawPassword,
      });

      assert.ok(result.id, 'Phải có trường id');
      assert.strictEqual(result.name, 'Nguyen Van Test');
      assert.strictEqual(result.email, testUserEmail.toLowerCase());
      assert.strictEqual(result.role, 'user');
      assert.strictEqual(result.password, undefined, 'Tuyệt đối không lộ trường password');
      createdUserId = result.id;
    });

    // --------------------------------------------------------------------------
    // 2. registerUser: Trùng email -> 409 Conflict
    // --------------------------------------------------------------------------
    await test('registerUser ném lỗi 409 Conflict khi email đã tồn tại trong hệ thống', async () => {
      await assert.rejects(
        async () => {
          await authService.registerUser({
            name: 'Nguyen Van Duplicate',
            email: testUserEmail,
            password: 'SomePassword123!',
          });
        },
        (err) => {
          assert.ok(err instanceof AppError, 'Phải là thực thể của AppError');
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.error, 'Conflict');
          assert.ok(err.message.includes('Email đã được sử dụng'));
          return true;
        }
      );
    });

    // --------------------------------------------------------------------------
    // 3. loginUser: Thành công
    // --------------------------------------------------------------------------
    await test('loginUser thành công: trả về safe user, JWT token hợp lệ và expiresIn', async () => {
      const loginResult = await authService.loginUser({
        email: testUserEmail,
        password: rawPassword,
      });

      assert.ok(loginResult.token, 'Phải có JWT token');
      assert.strictEqual(loginResult.user.id, createdUserId);
      assert.strictEqual(loginResult.user.password, undefined, 'Không lộ password trong response login');
      assert.strictEqual(loginResult.expiresIn, config.jwt.expiresIn);

      // Verify token
      const decoded = await verifyToken(loginResult.token);
      assert.strictEqual(decoded.id, createdUserId, 'Token id phải khớp với userId');
    });

    // --------------------------------------------------------------------------
    // 4. loginUser: Sai email -> 401 Unauthorized
    // --------------------------------------------------------------------------
    await test('loginUser ném 401 Unauthorized khi email không tồn tại (chống enumeration)', async () => {
      await assert.rejects(
        async () => {
          await authService.loginUser({
            email: 'nonexistent_account@example.com',
            password: rawPassword,
          });
        },
        (err) => {
          assert.ok(err instanceof AppError);
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.error, 'Unauthorized');
          assert.strictEqual(err.message, 'Email hoặc mật khẩu không đúng');
          return true;
        }
      );
    });

    // --------------------------------------------------------------------------
    // 5. loginUser: Sai mật khẩu -> 401 Unauthorized
    // --------------------------------------------------------------------------
    await test('loginUser ném 401 Unauthorized khi mật khẩu sai', async () => {
      await assert.rejects(
        async () => {
          await authService.loginUser({
            email: testUserEmail,
            password: 'WrongPassword999!',
          });
        },
        (err) => {
          assert.ok(err instanceof AppError);
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.error, 'Unauthorized');
          assert.strictEqual(err.message, 'Email hoặc mật khẩu không đúng');
          return true;
        }
      );
    });

    // --------------------------------------------------------------------------
    // 6. changeUserPassword: Sai mật khẩu hiện tại -> 401 Unauthorized
    // --------------------------------------------------------------------------
    await test('changeUserPassword ném 401 khi mật khẩu hiện tại không khớp', async () => {
      await assert.rejects(
        async () => {
          await authService.changeUserPassword({
            userId: createdUserId,
            currentPassword: 'WrongCurrentPassword!',
            newPassword: updatedPassword,
          });
        },
        (err) => {
          assert.ok(err instanceof AppError);
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.message, 'Mật khẩu hiện tại không đúng');
          return true;
        }
      );
    });

    // --------------------------------------------------------------------------
    // 7. changeUserPassword: Mật khẩu mới trùng mật khẩu cũ -> 400 Bad Request
    // --------------------------------------------------------------------------
    await test('changeUserPassword ném 400 Bad Request khi mật khẩu mới trùng mật khẩu hiện tại', async () => {
      await assert.rejects(
        async () => {
          await authService.changeUserPassword({
            userId: createdUserId,
            currentPassword: rawPassword,
            newPassword: rawPassword,
          });
        },
        (err) => {
          assert.ok(err instanceof AppError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.error, 'Bad Request');
          assert.ok(err.message.includes('Mật khẩu mới không được trùng'));
          return true;
        }
      );
    });

    // --------------------------------------------------------------------------
    // 8. changeUserPassword: Không tìm thấy userId -> 401 Unauthorized
    // --------------------------------------------------------------------------
    await test('changeUserPassword ném 401 khi userId không tồn tại', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await assert.rejects(
        async () => {
          await authService.changeUserPassword({
            userId: fakeId,
            currentPassword: rawPassword,
            newPassword: updatedPassword,
          });
        },
        (err) => {
          assert.ok(err instanceof AppError);
          assert.strictEqual(err.statusCode, 401);
          assert.ok(err.message.includes('không còn tồn tại'));
          return true;
        }
      );
    });

    // --------------------------------------------------------------------------
    // 9. changeUserPassword: Thành công và kiểm tra hiệu lực
    // --------------------------------------------------------------------------
    await test('changeUserPassword thành công: đổi được mật khẩu và cập nhật passwordChangedAt', async () => {
      await authService.changeUserPassword({
        userId: createdUserId,
        currentPassword: rawPassword,
        newPassword: updatedPassword,
      });

      // Mật khẩu cũ không đăng nhập được nữa
      await assert.rejects(
        async () => {
          await authService.loginUser({
            email: testUserEmail,
            password: rawPassword,
          });
        },
        (err) => err.statusCode === 401
      );

      // Mật khẩu mới đăng nhập thành công
      const reLogin = await authService.loginUser({
        email: testUserEmail,
        password: updatedPassword,
      });
      assert.ok(reLogin.token, 'Đăng nhập thành công với mật khẩu mới');

      // Kiểm tra passwordChangedAt đã được lưu vào MongoDB
      const userInDb = await User.findById(createdUserId).select('+passwordChangedAt');
      assert.ok(userInDb.passwordChangedAt, 'Phải có trường passwordChangedAt');
    });

  } finally {
    // Dọn dẹp dữ liệu test
    await User.deleteMany({ email: new RegExp(`^${TEST_EMAIL_PREFIX}`) });
    if (ownConnection) {
      await mongoose.disconnect();
      console.log('[INFO] Đã ngắt kết nối MongoDB.');
    }
  }

  console.log(`\n[KẾT QUẢ AUTH SERVICE TESTS]: ${passed}/${total} PASS\n`);
  return { passed, total };
}

if (require.main === module) {
  runAuthServiceTests().catch((err) => {
    console.error('Lỗi ngoại lệ trong test suite:', err);
    process.exit(1);
  });
}

module.exports = runAuthServiceTests;
