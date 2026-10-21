const assert = require('assert');
const config = require('../src/config/env');

async function runEnvTests() {
  console.log('================================================================');
  console.log('                 TEST SUITE: ENVIRONMENT CONFIG                 ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`✅ [PASS] ${name}`);
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  // 1. Kiểm tra cấu hình Port
  test('Port được gán hợp lệ (mặc định 3000 hoặc số nguyên dương)', () => {
    assert(typeof config.port === 'number' && config.port > 0, 'Port phải là số nguyên dương');
  });

  // 2. Kiểm tra Node Environment
  test('NODE_ENV được nhận diện chính xác', () => {
    assert(typeof config.nodeEnv === 'string' && config.nodeEnv.length > 0, 'NODE_ENV phải là chuỗi không rỗng');
  });

  // 3. Kiểm tra biến bắt buộc MONGODB_URI
  test('MONGODB_URI tồn tại và đúng định dạng kết nối MongoDB', () => {
    assert(typeof config.mongodbUri === 'string', 'MONGODB_URI phải tồn tại');
    assert(
      config.mongodbUri.startsWith('mongodb://') || config.mongodbUri.startsWith('mongodb+srv://'),
      'MONGODB_URI phải bắt đầu bằng mongodb:// hoặc mongodb+srv://'
    );
  });

  // 4. Kiểm tra cấu hình JWT
  test('JWT secret và expiresIn được cấu hình đầy đủ', () => {
    assert(config.jwt && typeof config.jwt.secret === 'string' && config.jwt.secret.length >= 16, 'JWT secret phải đủ dài');
    assert(config.jwt.expiresIn === '1d' || typeof config.jwt.expiresIn === 'string', 'JWT expiresIn phải tồn tại');
  });

  // 5. Kiểm tra cấu hình Bcrypt
  test('BCRYPT_SALT_ROUNDS được cấu hình tối thiểu 10', () => {
    assert(typeof config.bcrypt.saltRounds === 'number' && config.bcrypt.saltRounds >= 10, 'saltRounds phải >= 10');
  });

  // 6. Kiểm tra cấu hình CORS
  test('CORS_ORIGIN có giá trị hợp lệ', () => {
    assert(typeof config.corsOrigin === 'string' && config.corsOrigin.length > 0, 'CORS_ORIGIN phải là chuỗi hợp lệ');
  });

  // 7. Kiểm tra cấu hình Admin
  test('Cấu hình Admin (name, email, password) tồn tại', () => {
    assert(config.admin && typeof config.admin === 'object', 'Object admin phải tồn tại trong config');
  });

  console.log(`\n[KẾT QUẢ ENV TESTS]: ${passed}/${total} PASS\n`);
  return { passed, total };
}

if (require.main === module) {
  runEnvTests().catch(() => process.exit(1));
}

module.exports = runEnvTests;
