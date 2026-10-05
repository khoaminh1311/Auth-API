const mongoose = require('mongoose');

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
