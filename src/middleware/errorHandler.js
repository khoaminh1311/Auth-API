const AppError = require('../utils/appError');
const config = require('../config/env');

// 1. Xử lý lỗi sai định dạng ID hoặc kiểu dữ liệu Mongoose
const handleCastErrorDB = (err) => {
  const message = `Dữ liệu không hợp lệ cho trường: ${err.path}`;
  return new AppError(message, 400, 'Bad Request');
};

// 2. Xử lý lỗi trùng lặp Unique Index (vd: trùng email)
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'trường dữ liệu';
  const message = `${field === 'email' ? 'Email' : field} đã được sử dụng`;
  return new AppError(message, 409, 'Conflict');
};

// 3. Xử lý lỗi Schema Validation của Mongoose
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = errors.join('. ');
  return new AppError(message, 400, 'Bad Request');
};

// 4. Xử lý lỗi chữ ký JWT không hợp lệ
const handleJWTError = () =>
  new AppError('Token không hợp lệ hoặc đã hết hạn', 401, 'Unauthorized');

// 5. Xử lý lỗi JWT hết hạn
const handleJWTExpiredError = () =>
  new AppError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 401, 'Unauthorized');

// 6. Xử lý lỗi kết nối MongoDB
const handleMongoConnectionError = () =>
  new AppError('Không thể kết nối đến cơ sở dữ liệu. Vui lòng thử lại sau', 503, 'Service Unavailable');

/**
 * Centralized Error Handling Middleware
 * - Đảm bảo mọi lỗi đều phản hồi chuẩn 3 trường: { message, error, statusCode }
 * - Tuyệt đối không để lộ stack trace hoặc cấu trúc DB nội bộ ra client
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.code = err.code;
  error.statusCode = err.statusCode || 500;
  error.error = err.error || 'Internal Server Error';

  // Chuẩn hóa các lỗi đặc thù từ database và runtime
  if (err.name === 'CastError') error = handleCastErrorDB(err);
  if (err.code === 11000) error = handleDuplicateFieldsDB(err);
  if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Lỗi cú pháp JSON (Malformed JSON body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new AppError('JSON payload không hợp lệ', 400, 'Bad Request');
  }

  // Lỗi kích thước body vượt quá giới hạn (limit: 10kb)
  if (err.type === 'entity.too.large' || err.status === 413) {
    error = new AppError('Kích thước payload vượt quá giới hạn cho phép (tối đa 10kb)', 413, 'Payload Too Large');
  }

  // Lỗi kết nối MongoDB server
  if (
    err.name === 'MongooseServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoTimeoutError'
  ) {
    error = handleMongoConnectionError();
  }

  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational;

  // Tiêu đề loại lỗi chuẩn HTTP
  let errorTitle = error.error;
  if (!errorTitle || errorTitle === 'Internal Server Error') {
    switch (statusCode) {
      case 400:
        errorTitle = 'Bad Request';
        break;
      case 401:
        errorTitle = 'Unauthorized';
        break;
      case 403:
        errorTitle = 'Forbidden';
        break;
      case 404:
        errorTitle = 'Not Found';
        break;
      case 409:
        errorTitle = 'Conflict';
        break;
      case 413:
        errorTitle = 'Payload Too Large';
        break;
      case 503:
        errorTitle = 'Service Unavailable';
        break;
      default:
        errorTitle = 'Internal Server Error';
    }
  }

  // Thông điệp an toàn: Trong production, lỗi 500 không operational không được để lộ chi tiết
  let message;
  if (isOperational) {
    message = error.message;
  } else if (config.nodeEnv === 'production') {
    message = 'Đã xảy ra lỗi máy chủ nội bộ';
  } else {
    message = error.message || 'Đã xảy ra lỗi máy chủ nội bộ';
  }

  // Log lỗi không mong muốn phía server (nhưng không lộ password hay secrets)
  if (statusCode >= 500 && config.nodeEnv !== 'test') {
    console.error(`[ERROR] Server Error (${statusCode}):`, err.message);
  }

  // Phản hồi đúng hợp đồng: { message, error, statusCode }
  return res.status(statusCode).json({
    message,
    error: errorTitle,
    statusCode,
  });
};

module.exports = errorHandler;
