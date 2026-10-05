const app = require('./app');
const config = require('./config/env');
const connectDatabase = require('./config/database');

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception! Đang dừng ứng dụng...', err);
  process.exit(1);
});

const startServer = async () => {
  try {
    // Chỉ khởi động HTTP server khi kết nối database thành công
    await connectDatabase(config.mongodbUri);

    const server = app.listen(config.port, () => {
      console.log(`[INFO] Server đang lắng nghe tại cổng ${config.port} trong môi trường ${config.nodeEnv}`);
    });

    process.on('unhandledRejection', (err) => {
      console.error('[FATAL] Unhandled Rejection! Đang đóng server...', err);
      server.close(() => {
        process.exit(1);
      });
    });

    process.on('SIGTERM', () => {
      console.log('[INFO] Nhận tín hiệu SIGTERM. Đang đóng server gracefully...');
      server.close(() => {
        console.log('[INFO] Server đã đóng.');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('[FATAL] Khởi động server thất bại:', error.message);
    process.exit(1);
  }
};

startServer();
