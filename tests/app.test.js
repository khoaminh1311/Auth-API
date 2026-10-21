/**
 * ==============================================================================
 * Test Suite: Express App & Global Middlewares
 * Mục tiêu: Kiểm tra toàn diện tầng ứng dụng Express chính (src/app.js):
 *   1. Health check endpoint (GET /health).
 *   2. Helmet security hardening headers & ẩn X-Powered-By.
 *   3. CORS configuration.
 *   4. Cơ chế xử lý 404 Not Found cho mọi HTTP methods (GET, POST, PUT, DELETE).
 *   5. Phòng chống Malformed JSON body (HTTP 400).
 *   6. Giới hạn kích thước payload 10KB (HTTP 413 Payload Too Large).
 * ==============================================================================
 */

const assert = require('assert');
const http = require('http');
const app = require('../src/app');

// Helper gửi HTTP request linh hoạt
function sendRequest(port, { method = 'GET', path = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {};
    let payload = null;

    if (body !== null) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      defaultHeaders['Content-Type'] = 'application/json';
      defaultHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: { ...defaultHeaders, ...headers },
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let parsedBody = rawData;
          try {
            parsedBody = JSON.parse(rawData);
          } catch {
            // Không phải JSON
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedBody,
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

async function runAppTests() {
  console.log('='.repeat(64));
  console.log('       TEST SUITE: APP INFRASTRUCTURE & GLOBAL SECURITY ');
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

  // Khởi động server trên ephemeral port (port 0)
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    // --------------------------------------------------------------------------
    // 1. Health check endpoint (GET /health)
    // --------------------------------------------------------------------------
    await test('GET /health trả về 200 OK với status="ok", uptime và timestamp', async () => {
      const res = await sendRequest(port, { method: 'GET', path: '/health' });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(typeof res.body.uptime, 'number');
      assert.ok(res.body.timestamp, 'Phải có trường timestamp');
      assert.ok(!isNaN(Date.parse(res.body.timestamp)), 'Timestamp phải là ISO string hợp lệ');
    });

    // --------------------------------------------------------------------------
    // 2. Helmet Security Hardening Headers
    // --------------------------------------------------------------------------
    await test('Helmet kích hoạt các tiêu đề bảo mật OWASP và ẩn X-Powered-By', async () => {
      const res = await sendRequest(port, { method: 'GET', path: '/health' });
      assert.strictEqual(res.headers['x-powered-by'], undefined, 'Phải ẩn hoàn toàn header X-Powered-By');
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(res.headers['x-frame-options'], 'SAMEORIGIN');
      assert.strictEqual(res.headers['x-download-options'], 'noopen');
    });

    // --------------------------------------------------------------------------
    // 3. CORS headers
    // --------------------------------------------------------------------------
    await test('CORS middleware cấu hình tiêu đề Access-Control-Allow-Origin', async () => {
      const res = await sendRequest(port, {
        method: 'GET',
        path: '/health',
        headers: { Origin: 'http://example.com' },
      });
      assert.ok(res.headers['access-control-allow-origin'], 'Phải có header access-control-allow-origin');
    });

    // --------------------------------------------------------------------------
    // 4. Cơ chế 404 Not Found đa phương thức
    // --------------------------------------------------------------------------
    await test('Trả về 404 Not Found theo định dạng chuẩn API cho mọi HTTP method chưa định tuyến', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];
      for (const method of methods) {
        const res = await sendRequest(port, { method, path: '/api/unsupported-endpoint' });
        assert.strictEqual(res.statusCode, 404, `Method ${method} phải trả về 404`);
        assert.strictEqual(res.body.statusCode, 404);
        assert.strictEqual(res.body.error, 'Not Found');
        assert.ok(res.body.message.includes('/api/unsupported-endpoint'));
      }
    });

    // --------------------------------------------------------------------------
    // 5. Malformed JSON Body -> 400 Bad Request
    // --------------------------------------------------------------------------
    await test('Bắt và chuẩn hóa lỗi Malformed JSON thành HTTP 400 Bad Request', async () => {
      const res = await sendRequest(port, {
        method: 'POST',
        path: '/api/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: '{"invalid_json": true, missing_brace',
      });

      assert.strictEqual(res.statusCode, 400);
      assert.deepStrictEqual(res.body, {
        message: 'JSON payload không hợp lệ',
        error: 'Bad Request',
        statusCode: 400,
      });
    });

    // --------------------------------------------------------------------------
    // 6. Payload Too Large (Giới hạn 10KB) -> 413 Payload Too Large
    // --------------------------------------------------------------------------
    await test('Từ chối payload vượt quá 10KB với HTTP 413 Payload Too Large', async () => {
      const largeData = 'A'.repeat(15 * 1024); // 15 KB
      const res = await sendRequest(port, {
        method: 'POST',
        path: '/api/auth/register',
        body: JSON.stringify({ data: largeData }),
      });

      assert.strictEqual(res.statusCode, 413);
      assert.strictEqual(res.body.statusCode, 413);
      assert.strictEqual(res.body.error, 'Payload Too Large');
      assert.ok(res.body.message.includes('10kb'));
    });

  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n[KẾT QUẢ APP TESTS]: ${passed}/${total} PASS\n`);
  return { passed, total };
}

if (require.main === module) {
  runAppTests().catch((err) => {
    console.error('Lỗi ngoại lệ trong test suite:', err);
    process.exit(1);
  });
}

module.exports = runAppTests;
