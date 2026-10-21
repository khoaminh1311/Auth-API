/**
 * ==============================================================================
 * Test Suite: Rate Limiting Middleware (Chống Brute-Force & DoS)
 * Mục tiêu: Kiểm tra rate limiting theo chuẩn RFC / IETF:
 *   1. Xuất hiện standard headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset).
 *   2. Header RateLimit-Remaining giảm dần sau mỗi request hợp lệ.
 *   3. Khi vượt ngưỡng request cho phép: Trả về HTTP 429 Too Many Requests.
 *   4. Định dạng phản hồi 429 chuẩn: { message, error: "Too Many Requests", statusCode: 429 }.
 *   5. Cô lập rate limit theo IP của client (IP khác không bị ảnh hưởng).
 * ==============================================================================
 */

const assert = require('assert');
const http = require('http');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { authLimiter } = require('../src/middleware/rateLimiter');

// Helper gửi HTTP request bằng http native module
function makeRequest(port, path = '/', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let body = data;
          try {
            body = JSON.parse(data);
          } catch {
            // Raw text
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runRateLimitTests() {
  console.log('='.repeat(64));
  console.log('        TEST SUITE: RATE LIMITING & DOS PROTECTION      ');
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

  // Tạo Express app chuyên dụng để test Rate Limiter
  const app = express();
  app.set('trust proxy', 1);

  // Endpoint 1: Sử dụng authLimiter chính của dự án
  app.get('/test-auth-limiter', authLimiter, (req, res) => {
    res.json({ success: true, message: 'Auth endpoint reached' });
  });

  // Endpoint 2: Limiter ngưỡng thấp (max: 3) để test cơ chế chặn 429
  const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    handler: (req, res) => {
      res.status(429).json({
        message: 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
        error: 'Too Many Requests',
        statusCode: 429,
      });
    },
  });

  app.get('/test-strict-limiter', strictLimiter, (req, res) => {
    res.json({ success: true, count: 'ok' });
  });

  // Khởi động server trên ephemeral port (port 0)
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    // --------------------------------------------------------------------------
    // 1. authLimiter trả về RateLimit headers chuẩn IETF
    // --------------------------------------------------------------------------
    await test('authLimiter trả về đầy đủ RateLimit-* standard headers', async () => {
      const res = await makeRequest(port, '/test-auth-limiter');
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.headers['ratelimit-limit'], 'Phải có header ratelimit-limit');
      assert.ok(res.headers['ratelimit-remaining'] !== undefined, 'Phải có header ratelimit-remaining');
      assert.ok(res.headers['ratelimit-reset'], 'Phải có header ratelimit-reset');
      // Không dùng legacy X-RateLimit headers
      assert.strictEqual(res.headers['x-ratelimit-limit'], undefined, 'Không nên có legacy header x-ratelimit-limit');
    });

    // --------------------------------------------------------------------------
    // 2. RateLimit-Remaining giảm dần sau mỗi request
    // --------------------------------------------------------------------------
    await test('RateLimit-Remaining giảm dần khi gửi liên tiếp nhiều request', async () => {
      const res1 = await makeRequest(port, '/test-strict-limiter', { 'X-Forwarded-For': '10.0.0.1' });
      const res2 = await makeRequest(port, '/test-strict-limiter', { 'X-Forwarded-For': '10.0.0.1' });

      assert.strictEqual(res1.statusCode, 200);
      assert.strictEqual(res2.statusCode, 200);

      const rem1 = parseInt(res1.headers['ratelimit-remaining'], 10);
      const rem2 = parseInt(res2.headers['ratelimit-remaining'], 10);
      assert.strictEqual(rem2, rem1 - 1, 'Remaining của req 2 phải nhỏ hơn req 1 đúng 1 đơn vị');
    });

    // --------------------------------------------------------------------------
    // 3. Chặn và trả về 429 khi vượt quá quota
    // --------------------------------------------------------------------------
    await test('Trả về HTTP 429 Too Many Requests khi vượt quá số lượng request cho phép', async () => {
      const clientIp = '192.168.1.100';
      // Gửi 3 requests (đạt limit = 3)
      for (let i = 0; i < 3; i++) {
        const res = await makeRequest(port, '/test-strict-limiter', { 'X-Forwarded-For': clientIp });
        assert.strictEqual(res.statusCode, 200);
      }

      // Request thứ 4 phải bị chặn ngay lập tức
      const blockedRes = await makeRequest(port, '/test-strict-limiter', { 'X-Forwarded-For': clientIp });
      assert.strictEqual(blockedRes.statusCode, 429, 'Phải trả về mã trạng thái HTTP 429');
      assert.strictEqual(blockedRes.headers['ratelimit-remaining'], '0', 'Remaining phải là 0');
    });

    // --------------------------------------------------------------------------
    // 4. Định dạng payload lỗi 429 khớp đúng API Contract
    // --------------------------------------------------------------------------
    await test('Payload 429 chuẩn định dạng { message, error, statusCode } theo hợp đồng API', async () => {
      const clientIp = '192.168.1.101';
      // Làm cạn quota
      for (let i = 0; i < 3; i++) {
        await makeRequest(port, '/test-strict-limiter', { 'X-Forwarded-For': clientIp });
      }

      const res429 = await makeRequest(port, '/test-strict-limiter', { 'X-Forwarded-For': clientIp });
      assert.strictEqual(res429.statusCode, 429);
      assert.deepStrictEqual(res429.body, {
        message: 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau 15 phút',
        error: 'Too Many Requests',
        statusCode: 429,
      });
    });

    // --------------------------------------------------------------------------
    // 5. Cô lập hạn mức theo từng IP
    // --------------------------------------------------------------------------
    await test('Client IP khác không bị ảnh hưởng khi một IP bị block 429', async () => {
      const blockedIp = '172.16.0.5';
      const freshIp = '172.16.0.6';

      // Block blockedIp
      for (let i = 0; i < 4; i++) {
        await makeRequest(port, '/test-strict-limiter', { 'X-Forwarded-For': blockedIp });
      }

      // Fresh IP vẫn gửi request bình thường và nhận 200 OK
      const freshRes = await makeRequest(port, '/test-strict-limiter', { 'X-Forwarded-For': freshIp });
      assert.strictEqual(freshRes.statusCode, 200);
      assert.strictEqual(freshRes.headers['ratelimit-remaining'], '2');
    });

  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n[KẾT QUẢ RATE LIMIT TESTS]: ${passed}/${total} PASS\n`);
  return { passed, total };
}

if (require.main === module) {
  runRateLimitTests().catch((err) => {
    console.error('Lỗi ngoại lệ trong test suite:', err);
    process.exit(1);
  });
}

module.exports = runRateLimitTests;
