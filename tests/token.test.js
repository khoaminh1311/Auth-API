const assert = require('assert');
const jwt = require('jsonwebtoken');
const { generateToken, verifyToken } = require('../src/utils/jwt');
const config = require('../src/config/env');

async function runTokenTests() {
  console.log('================================================================');
  console.log('                 TEST SUITE: JWT TOKEN UTILITIES                ');
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

  const sampleUserId = '662c8b7f3e9b2d4b7f1a2c3d';
  let validToken;

  // 1. Tạo token hợp lệ
  await test('generateToken tạo ra chuỗi JWT 3 phần hợp lệ', () => {
    validToken = generateToken(sampleUserId);
    assert(typeof validToken === 'string', 'Token phải là chuỗi string');
    const parts = validToken.split('.');
    assert(parts.length === 3, 'JWT phải gồm 3 phần: header.payload.signature');
  });

  // 2. Kiểm tra Payload tối giản bảo mật
  await test('Token payload chứa đúng id và không lộ thông tin nhạy cảm', () => {
    const decoded = jwt.decode(validToken);
    assert.strictEqual(decoded.id, sampleUserId, 'Payload phải chứa đúng userId');
    assert.strictEqual(decoded.password, undefined, 'Payload không được chứa password');
    assert.strictEqual(decoded.role, undefined, 'Payload JWT tối giản không chứa role');
  });

  // 3. Kiểm tra thời hạn token (expiresIn)
  await test('Token có thời hạn sống đúng chuẩn 1d (86400 giây)', () => {
    const decoded = jwt.decode(validToken);
    const lifeTime = decoded.exp - decoded.iat;
    assert.strictEqual(lifeTime, 86400, 'Thời hạn token phải đúng 86400 giây (24 giờ)');
  });

  // 4. Xác minh token hợp lệ thành công
  await test('verifyToken giải mã thành công token hợp lệ', async () => {
    const decoded = await verifyToken(validToken);
    assert.strictEqual(decoded.id, sampleUserId, 'Decoded id phải khớp với userId ban đầu');
  });

  // 5. Từ chối token bị sửa đổi chữ ký (Tampered Token)
  await test('verifyToken từ chối token bị sửa đổi chữ ký (JsonWebTokenError)', async () => {
    const parts = validToken.split('.');
    const tampered = `${parts[0]}.${parts[1]}.tamperedSignature`;
    await assert.rejects(
      async () => verifyToken(tampered),
      (err) => err.name === 'JsonWebTokenError',
      'Token bị sửa chữ ký phải ném lỗi JsonWebTokenError'
    );
  });

  // 6. Từ chối token ký bằng secret giả mạo
  await test('verifyToken từ chối token ký bằng secret khác', async () => {
    const fakeToken = jwt.sign({ id: sampleUserId }, 'wrong_secret_key_1234567890');
    await assert.rejects(
      async () => verifyToken(fakeToken),
      (err) => err.name === 'JsonWebTokenError',
      'Token ký bằng secret khác phải bị từ chối'
    );
  });

  // 7. Từ chối token hết hạn (TokenExpiredError)
  await test('verifyToken nhận diện chính xác token hết hạn (TokenExpiredError)', async () => {
    const expiredToken = jwt.sign({ id: sampleUserId }, config.jwt.secret, { expiresIn: '-1s' });
    await assert.rejects(
      async () => verifyToken(expiredToken),
      (err) => err.name === 'TokenExpiredError',
      'Token hết hạn phải ném lỗi TokenExpiredError'
    );
  });

  console.log(`\n[KẾT QUẢ TOKEN TESTS]: ${passed}/${total} PASS\n`);
  return { passed, total };
}

if (require.main === module) {
  runTokenTests().catch(() => process.exit(1));
}

module.exports = runTokenTests;
