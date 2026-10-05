const mongoose = require('mongoose');
const dns = require('dns');

// Khắc phục lỗi Node.js c-ares trên Windows khi dns.getServers() trả về ['127.0.0.1']
if (process.platform === 'win32') {
  const currentServers = dns.getServers();
  if (currentServers.length === 1 && currentServers[0] === '127.0.0.1') {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch {
      // Bỏ qua nếu không thể đặt servers
    }
  }
}

const connectDatabase = async (mongodbUri) => {
  try {
    const conn = await mongoose.connect(mongodbUri);
    console.log(`[INFO] Kết nối MongoDB thành công: Host: ${conn.connection.host}, Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[ERROR] Không thể kết nối MongoDB: ${error.message}`);
    throw error;
  }
};

module.exports = connectDatabase;
