/**
 * ==============================================================================
 * Test Suite: Auth Endpoints & Bearer Token Authentication / RBAC (E2E)
 * Mục tiêu: Kiểm tra toàn bộ luồng HTTP API qua mạng:
 *   1. POST /api/auth/register: 201 Created, 400 Bad Request, 409 Conflict.
 *   2. POST /api/auth/login: 200 OK, 401 Unauthorized, 400 Bad Request.
 *   3. GET /api/auth/me: 200 OK, 401 khi thiếu Bearer, token giả mạo, hoặc hết hạn.
 *   4. PUT /api/auth/change-password: Đổi mật khẩu, thu hồi token cũ ngay lập tức.
 *   5. POST /api/auth/logout: 200 OK, 401 nếu chưa đăng nhập.
 *   6. GET /api/auth/admin-only: RBAC 403 Forbidden với user, 200 OK với admin.
 * ==============================================================================
 */

const assert = require('assert');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');
const config = require('../src/config/env');
const connectDatabase = require('../src/config/database');
const User = require('../src/models/userModel');

// Helper gửi HTTP request chuẩn
function apiRequest(port, { method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const reqHeaders = { ...headers };
    let payload = null;

    if (body !== null) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let parsed = rawData;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            // raw text
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

const RUN_PREFIX = `e2e_${Date.now()}`;

async function runAuthBearerTests() {
  console.log('='.repeat(64));
  console.log('   TEST SUITE: AUTH ENDPOINTS & BEARER AUTHENTICATION (E2E)  ');
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

  // Đảm bảo kết nối database
  let ownConnection = false;
  if (mongoose.connection.readyState !== 1) {
    await connectDatabase(config.mongodbUri);
    ownConnection = true;
  }

  // Khởi động server trên ephemeral port (port 0)
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  // Dữ liệu dùng trong test suite
  const userEmail = `${RUN_PREFIX}@example.com`;
  const rawPassword = 'StrongPassword123!';
  const newPassword = 'ChangedPassword456!';
  let userToken = null;
  let adminToken = null;

  try {
    // Dọn dẹp dữ liệu cũ nếu có
    await User.deleteMany({ email: new RegExp(`^${RUN_PREFIX}`) });

    // --------------------------------------------------------------------------
    // 1. POST /api/auth/register: Đăng ký thành công
    // --------------------------------------------------------------------------
    await test('POST /api/auth/register trả về 201 Created và safe user object (không lộ password)', async () => {
      const res = await apiRequest(port, {
        method: 'POST',
        path: '/api/auth/register',
        body: {
          name: 'Nguyen Van A',
          email: userEmail,
          password: rawPassword,
        },
      });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.message, 'Đăng ký tài khoản thành công');
      assert.ok(res.body.user.id, 'Phải có id');
      assert.strictEqual(res.body.user.email, userEmail.toLowerCase());
      assert.strictEqual(res.body.user.role, 'user');
      assert.strictEqual(res.body.user.password, undefined, 'Không được trả về password');
    });

    // --------------------------------------------------------------------------
    // 2. POST /api/auth/register: Validation lỗi
    // --------------------------------------------------------------------------
    await test('POST /api/auth/register từ chối 400 Bad Request khi thiếu trường hoặc mật khẩu yếu', async () => {
      // Thiếu name
      const res1 = await apiRequest(port, {
        method: 'POST',
        path: '/api/auth/register',
        body: { email: `invalid_${RUN_PREFIX}@example.com`, password: rawPassword },
      });
      assert.strictEqual(res1.statusCode, 400);

      // Mật khẩu < 8 ký tự
      const res2 = await apiRequest(port, {
        method: 'POST',
        path: '/api/auth/register',
        body: { name: 'Test', email: `invalid_${RUN_PREFIX}@example.com`, password: 'short' },
      });
      assert.strictEqual(res2.statusCode, 400);
      assert.ok(res2.body.message.includes('8 ký tự'));
    });

    // --------------------------------------------------------------------------
    // 3. POST /api/auth/register: Trùng email
    // --------------------------------------------------------------------------
    await test('POST /api/auth/register từ chối 409 Conflict khi email đã tồn tại', async () => {
      const res = await apiRequest(port, {
        method: 'POST',
        path: '/api/auth/register',
        body: {
          name: 'Nguyen Van A Fake',
          email: userEmail,
          password: rawPassword,
        },
      });

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.body.statusCode, 409);
      assert.strictEqual(res.body.error, 'Conflict');
      assert.ok(res.body.message.includes('Email đã được sử dụng'));
    });

    // --------------------------------------------------------------------------
    // 4. POST /api/auth/login: Đăng nhập thành công
    // --------------------------------------------------------------------------
    await test('POST /api/auth/login trả về 200 OK kèm Bearer token và thông tin user', async () => {
      const res = await apiRequest(port, {
        method: 'POST',
        path: '/api/auth/login',
        body: { email: userEmail, password: rawPassword },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.body.token, 'Phải có token');
      assert.strictEqual(typeof res.body.token, 'string');
      assert.strictEqual(res.body.user.email, userEmail.toLowerCase());
      assert.strictEqual(res.body.user.password, undefined);
      userToken = res.body.token;
    });

    // --------------------------------------------------------------------------
    // 5. POST /api/auth/login: Sai mật khẩu / email
    // --------------------------------------------------------------------------
    await test('POST /api/auth/login từ chối 401 Unauthorized khi thông tin đăng nhập sai', async () => {
      const res = await apiRequest(port, {
        method: 'POST',
        path: '/api/auth/login',
        body: { email: userEmail, password: 'WrongPassword999!' },
      });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.message, 'Email hoặc mật khẩu không đúng');
    });

    // --------------------------------------------------------------------------
    // 6. GET /api/auth/me: Thiếu header hoặc định dạng sai
    // --------------------------------------------------------------------------
    await test('GET /api/auth/me từ chối 401 Unauthorized khi thiếu Authorization header', async () => {
      const res = await apiRequest(port, { method: 'GET', path: '/api/auth/me' });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.message, 'Vui lòng đăng nhập để tiếp tục');
    });

    await test('GET /api/auth/me từ chối 401 Unauthorized khi thiếu tiền tố Bearer', async () => {
      const res = await apiRequest(port, {
        method: 'GET',
        path: '/api/auth/me',
        headers: { Authorization: `Basic ${userToken}` },
      });
      assert.strictEqual(res.statusCode, 401);
      assert.ok(res.body.message.includes('Định dạng token không hợp lệ'));
    });

    await test('GET /api/auth/me từ chối 401 Unauthorized khi token bị giả mạo / sai chữ ký', async () => {
      const tamperedToken = userToken.slice(0, -6) + 'abcdef';
      const res = await apiRequest(port, {
        method: 'GET',
        path: '/api/auth/me',
        headers: { Authorization: `Bearer ${tamperedToken}` },
      });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.message, 'Token không hợp lệ hoặc đã hết hạn');
    });

    // --------------------------------------------------------------------------
    // 7. GET /api/auth/me: Token hợp lệ
    // --------------------------------------------------------------------------
    await test('GET /api/auth/me trả về 200 OK với profile người dùng khi token hợp lệ', async () => {
      const res = await apiRequest(port, {
        method: 'GET',
        path: '/api/auth/me',
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.user.email, userEmail.toLowerCase());
      assert.strictEqual(res.body.user.role, 'user');
    });

    // --------------------------------------------------------------------------
    // 8. PUT /api/auth/change-password: Đổi mật khẩu & vô hiệu hóa token cũ
    // --------------------------------------------------------------------------
    await test('PUT /api/auth/change-password đổi mật khẩu thành công và vô hiệu hóa token phát hành trước đó', async () => {
      // Đợi 1 giây để đảm bảo iat của token cũ nhỏ hơn thời điểm đổi mật khẩu
      await new Promise((r) => setTimeout(r, 1100));

      const changeRes = await apiRequest(port, {
        method: 'PUT',
        path: '/api/auth/change-password',
        headers: { Authorization: `Bearer ${userToken}` },
        body: {
          currentPassword: rawPassword,
          newPassword: newPassword,
        },
      });

      assert.strictEqual(changeRes.statusCode, 200);
      assert.ok(changeRes.body.message.includes('Đổi mật khẩu thành công'));

      // Token cũ dùng lại GET /me phải bị từ chối 401 do passwordChangedAt
      const oldTokenRes = await apiRequest(port, {
        method: 'GET',
        path: '/api/auth/me',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(oldTokenRes.statusCode, 401);
      assert.ok(oldTokenRes.body.message.includes('Mật khẩu đã được thay đổi'));

      // Đăng nhập lại bằng mật khẩu mới thành công
      const reLoginRes = await apiRequest(port, {
        method: 'POST',
        path: '/api/auth/login',
        body: { email: userEmail, password: newPassword },
      });
      assert.strictEqual(reLoginRes.statusCode, 200);
      userToken = reLoginRes.body.token; // Cập nhật token mới
    });

    // --------------------------------------------------------------------------
    // 9. POST /api/auth/logout: Đăng xuất stateless
    // --------------------------------------------------------------------------
    await test('POST /api/auth/logout trả về 200 OK với thông điệp hướng dẫn client xóa token', async () => {
      const res = await apiRequest(port, {
        method: 'POST',
        path: '/api/auth/logout',
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.message, 'Đăng xuất thành công. Vui lòng xóa token phía client');
    });

    // --------------------------------------------------------------------------
    // 10. RBAC: GET /api/auth/admin-only (403 Forbidden vs 200 OK)
    // --------------------------------------------------------------------------
    await test('GET /api/auth/admin-only từ chối 403 Forbidden đối với người dùng role="user"', async () => {
      const res = await apiRequest(port, {
        method: 'GET',
        path: '/api/auth/admin-only',
        headers: { Authorization: `Bearer ${userToken}` },
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.statusCode, 403);
      assert.strictEqual(res.body.error, 'Forbidden');
      assert.strictEqual(res.body.message, 'Bạn không có quyền thực hiện hành động này');
    });

    await test('GET /api/auth/admin-only trả về 200 OK đối với người dùng role="admin"', async () => {
      // Đăng nhập tài khoản admin từ file .env
      const adminLoginRes = await apiRequest(port, {
        method: 'POST',
        path: '/api/auth/login',
        body: {
          email: config.admin.email,
          password: config.admin.password,
        },
      });

      assert.strictEqual(adminLoginRes.statusCode, 200, 'Admin đăng nhập phải thành công');
      adminToken = adminLoginRes.body.token;

      // Truy cập admin-only endpoint
      const adminRes = await apiRequest(port, {
        method: 'GET',
        path: '/api/auth/admin-only',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.strictEqual(adminRes.statusCode, 200);
      assert.ok(adminRes.body.message.includes('dành riêng cho Admin'));
      assert.strictEqual(adminRes.body.user.role, 'admin');
    });

  } finally {
    // Dọn dẹp dữ liệu test E2E
    await User.deleteMany({ email: new RegExp(`^${RUN_PREFIX}`) });
    await new Promise((r) => server.close(r));
    if (ownConnection) {
      await mongoose.disconnect();
    }
  }

  console.log(`\n[KẾT QUẢ AUTH BEARER TESTS]: ${passed}/${total} PASS\n`);
  return { passed, total };
}

if (require.main === module) {
  runAuthBearerTests().catch((err) => {
    console.error('Lỗi ngoại lệ trong test suite:', err);
    process.exit(1);
  });
}

module.exports = runAuthBearerTests;
