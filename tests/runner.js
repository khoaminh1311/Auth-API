/**
 * ==============================================================================
 * Test Suite Coordinator & Runner (Native Node.js Test Orchestrator)
 * Mục tiêu:
 *   1. Chạy tuần tự tất cả các module test trong thư mục tests/:
 *      - tests/env.test.js
 *      - tests/token.test.js
 *      - tests/user.model.test.js
 *      - tests/authService.test.js
 *      - tests/rateLimit.test.js
 *      - tests/app.test.js
 *      - tests/httpServer.test.js
 *      - tests/authBearer.test.js
 *   2. Thu thập kết quả, tính thời gian thực thi.
 *   3. In bảng tổng kết trực quan, chuyên nghiệp.
 *   4. Trả về Exit Code 0 nếu toàn bộ pass, 1 nếu có bất kỳ lỗi nào.
 * ==============================================================================
 */

const path = require('path');

const SUITES = [
  { name: '1. Biến Môi Trường (Config & Environment)', file: './env.test.js' },
  { name: '2. Tiện Ích JWT (Signing, Verify, Tampering)', file: './token.test.js' },
  { name: '3. Mongoose User Model (Schema & Bcrypt Hook)', file: './user.model.test.js' },
  { name: '4. Nghiệp Vụ AuthService (Business Logic)', file: './authService.test.js' },
  { name: '5. Rate Limiting & DoS Protection', file: './rateLimit.test.js' },
  { name: '6. Tầng Ứng Dụng & Header Bảo Mật (Express App)', file: './app.test.js' },
  { name: '7. Vòng Đời HTTP Server & Seed Admin', file: './httpServer.test.js' },
  { name: '8. HTTP Endpoints & Bearer RBAC (E2E Integration)', file: './authBearer.test.js' },
];

async function runAll() {
  const startTime = Date.now();
  console.log('\n' + '='.repeat(72));
  console.log('         BẮT ĐẦU CHẠY TOÀN BỘ TEST SUITES CỦA DỰ ÁN AUTH-API         ');
  console.log('='.repeat(72) + '\n');

  const summary = [];
  let grandTotalPassed = 0;
  let grandTotalTests = 0;
  let hasFailure = false;

  for (const suite of SUITES) {
    const suiteStart = Date.now();
    try {
      const runner = require(suite.file);
      const result = await runner();
      const elapsed = ((Date.now() - suiteStart) / 1000).toFixed(2);

      const passed = result ? result.passed : 0;
      const total = result ? result.total : 0;
      grandTotalPassed += passed;
      grandTotalTests += total;

      const isSuccess = passed === total && total > 0;
      if (!isSuccess) hasFailure = true;

      summary.push({
        suite: suite.name,
        result: isSuccess ? 'PASS' : 'FAIL',
        passed,
        total,
        duration: `${elapsed}s`,
      });
    } catch (err) {
      const elapsed = ((Date.now() - suiteStart) / 1000).toFixed(2);
      hasFailure = true;
      console.error(`\n❌ [EXCEPTION] Lỗi khi chạy suite "${suite.name}":`, err.message);
      summary.push({
        suite: suite.name,
        result: 'ERROR',
        passed: 0,
        total: 1,
        duration: `${elapsed}s`,
      });
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  // In bảng tổng kết
  console.log('\n' + '='.repeat(72));
  console.log('                         BẢNG TỔNG KẾT KIỂM THỬ                         ');
  console.log('='.repeat(72));
  console.log(
    'STT'.padEnd(6) +
    'Test Suite'.padEnd(46) +
    'Trạng Thái'.padEnd(12) +
    'Pass / Total'.padEnd(14) +
    'Thời Gian'
  );
  console.log('-'.repeat(88));

  summary.forEach((item, index) => {
    const statusSymbol = item.result === 'PASS' ? '✅ PASS' : '❌ ' + item.result;
    console.log(
      `#${index + 1}`.padEnd(6) +
      item.suite.padEnd(46) +
      statusSymbol.padEnd(12) +
      `${item.passed}/${item.total}`.padEnd(14) +
      item.duration
    );
  });

  console.log('='.repeat(72));
  console.log(`TỔNG KẾT TOÀN BỘ: ${grandTotalPassed}/${grandTotalTests} TESTS PASSED (${totalElapsed}s)`);
  
  if (hasFailure) {
    console.log('TRẠNG THÁI CUỐI CÙNG: ❌ FAILED (Có bài test không đạt yêu cầu)');
    console.log('='.repeat(72) + '\n');
    process.exit(1);
  } else {
    console.log('TRẠNG THÁI CUỐI CÙNG: ✅ ALL SUITES PASSED HOÀN TOÀN');
    console.log('='.repeat(72) + '\n');
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error('Fatal Runner Error:', err);
  process.exit(1);
});
