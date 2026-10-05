const mongoose = require('mongoose');
const dns = require('dns');

// Khắc phục lỗi Node.js c-ares trên Windows khi dns.getServers() trả về ['127.0.0.1']
// c-ares không đọc được DNS adapter từ Windows, dẫn đến ECONNREFUSED khi resolve SRV record MongoDB Atlas
// Giải pháp: tự động phát hiện DNS thực từ Windows adapter đang kết nối internet
if (process.platform === 'win32') {
  const currentServers = dns.getServers();
  if (currentServers.length === 1 && currentServers[0] === '127.0.0.1') {
    try {
      const { execSync } = require('child_process');
      const output = execSync(
        'powershell -NoProfile -Command "Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses"',
        { encoding: 'utf8', timeout: 3000 }
      ).trim();
      const windowsDnsServers = output.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (windowsDnsServers.length > 0) {
        dns.setServers(windowsDnsServers);
      }
    } catch {
      // Bỏ qua nếu không thể phát hiện DNS — Mongoose sẽ thử kết nối với cấu hình hiện tại
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
