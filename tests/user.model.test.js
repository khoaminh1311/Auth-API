const assert = require('assert');
const mongoose = require('mongoose');
const config = require('../src/config/env');
const connectDatabase = require('../src/config/database');
const User = require('../src/models/userModel');

async function runUserModelTests() {
  console.log('================================================================');
  console.log('                 TEST SUITE: USER MONGOOSE MODEL                ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`✅ [PASS] ${name}`);
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  const timestamp = Date.now();
  const testEmail = `model_test_${timestamp}@example.com`;
  const plainPassword = 'ModelPassword123!';

  try {
    await connectDatabase(config.mongodbUri);

    // 1. Kiểm tra validation bắt buộc thiếu name
    await test('Model từ chối khi thiếu họ tên (required validation)', async () => {
      const u = new User({ email: `v1_${timestamp}@example.com`, password: plainPassword });
      await assert.rejects(async () => u.validate(), /họ và tên/i);
    });

    // 2. Kiểm tra validation độ dài name (< 2 ký tự)
    await test('Model từ chối khi họ tên < 2 ký tự', async () => {
      const u = new User({ name: 'A', email: `v2_${timestamp}@example.com`, password: plainPassword });
      await assert.rejects(async () => u.validate(), /ít nhất 2 ký tự/i);
    });

    // 3. Kiểm tra validation độ dài name (> 50 ký tự)
    await test('Model từ chối khi họ tên > 50 ký tự', async () => {
      const u = new User({ name: 'A'.repeat(51), email: `v3_${timestamp}@example.com`, password: plainPassword });
      await assert.rejects(async () => u.validate(), /không được vượt quá 50 ký tự/i);
    });

    // 4. Kiểm tra validation email sai định dạng RFC 5322
    await test('Model từ chối email không hợp lệ (validator.js)', async () => {
      const u1 = new User({ name: 'Tester', email: 'invalid-email', password: plainPassword });
      await assert.rejects(async () => u1.validate(), /Địa chỉ email không đúng định dạng/i);

      const u2 = new User({ name: 'Tester', email: 'test@.com', password: plainPassword });
      await assert.rejects(async () => u2.validate(), /Địa chỉ email không đúng định dạng/i);
    });

    // 5. Kiểm tra validation độ dài mật khẩu (< 8 và > 128)
    await test('Model từ chối mật khẩu < 8 ký tự hoặc > 128 ký tự', async () => {
      const shortPass = new User({ name: 'Tester', email: `v4_${timestamp}@example.com`, password: '123' });
      await assert.rejects(async () => shortPass.validate(), /tối thiểu 8 ký tự/i);

      const longPass = new User({ name: 'Tester', email: `v5_${timestamp}@example.com`, password: 'A'.repeat(129) });
      await assert.rejects(async () => longPass.validate(), /không được vượt quá 128 ký tự/i);
    });

    // 6. Kiểm tra Pre-save hook tự động băm mật khẩu bằng Bcrypt
    let createdUser;
    await test('Pre-save hook băm mật khẩu an toàn với bcrypt (saltRounds = 12)', async () => {
      createdUser = await User.create({
        name: 'Model Tester',
        email: testEmail,
        password: plainPassword,
      });

      assert(createdUser._id, 'User phải được lưu vào database');
      assert.notStrictEqual(createdUser.password, plainPassword, 'Mật khẩu trong DB không được là plaintext');
      assert(createdUser.password.startsWith('$2b$12$') || createdUser.password.startsWith('$2a$12$'), 'Mật khẩu phải được băm với cost 12');
    });

    // 7. Kiểm tra method comparePassword
    await test('comparePassword so khớp chính xác mật khẩu đúng/sai', async () => {
      const isMatch = await createdUser.comparePassword(plainPassword);
      assert.strictEqual(isMatch, true, 'comparePassword phải trả về true với mật khẩu đúng');

      const isMismatch = await createdUser.comparePassword('WrongPassword999!');
      assert.strictEqual(isMismatch, false, 'comparePassword phải trả về false với mật khẩu sai');
    });

    // 8. Kiểm tra method changedPasswordAfter
    await test('changedPasswordAfter xác định chính xác thời điểm đổi mật khẩu', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      assert.strictEqual(createdUser.changedPasswordAfter(nowSec), false, 'Chưa đổi mật khẩu phải trả về false');

      // Đổi mật khẩu
      createdUser.password = 'NewPassword999!';
      await createdUser.save();

      // Token được cấp ở thời điểm quá khứ (trước khi đổi mật khẩu)
      const pastTokenTime = nowSec - 50;
      assert.strictEqual(createdUser.changedPasswordAfter(pastTokenTime), true, 'Token cấp trước khi đổi mật khẩu phải trả về true');
    });

    // 9. Kiểm tra toSafeObject không lộ mật khẩu hay thông tin nội bộ
    await test('toSafeObject chỉ trả 4 trường: id, name, email, role', () => {
      const safe = createdUser.toSafeObject();
      assert.strictEqual(typeof safe.id, 'string', 'Safe object phải có id');
      assert.strictEqual(safe.name, createdUser.name, 'Safe object phải có name');
      assert.strictEqual(safe.email, createdUser.email, 'Safe object phải có email');
      assert.strictEqual(safe.role, 'user', 'Role mặc định phải là user');

      assert.strictEqual(safe.password, undefined, 'Tuyệt đối không lộ password');
      assert.strictEqual(safe.passwordChangedAt, undefined, 'Không lộ passwordChangedAt');
      assert.strictEqual(safe.__v, undefined, 'Không lộ __v');
      assert.strictEqual(Object.keys(safe).length, 4, 'Safe object chỉ chứa đúng 4 trường');
    });

  } finally {
    // Dọn dẹp dữ liệu test
    try {
      await User.deleteMany({ email: { $regex: `_${timestamp}@example.com` } });
    } catch (_) {}
    if (require.main === module) {
      await mongoose.disconnect();
    }
  }

  console.log(`\n[KẾT QUẢ USER MODEL TESTS]: ${passed}/${total} PASS\n`);
  return { passed, total };
}

if (require.main === module) {
  runUserModelTests().catch(() => process.exit(1));
}

module.exports = runUserModelTests;
