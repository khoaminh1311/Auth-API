const AppError = require('../utils/appError');

const handleCastErrorDB = (err) => {
  const message = `Dữ liệu không hợp lệ cho trường: ${err.path}`;
  return new AppError(message, 400, 'Bad Request');
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'trường dữ liệu';
  const message = `${field === 'email' ? 'Email' : field} đã được sử dụng`;
  return new AppError(message, 409, 'Conflict');
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = errors.join('. ');
  return new AppError(message, 400, 'Bad Request');
};

const handleJWTError = () =>
  new AppError('Token không hợp lệ hoặc đã hết hạn', 401, 'Unauthorized');

const handleJWTExpiredError = () =>
  new AppError('Token đã hết hạn, vui lòng đăng nhập lại', 401, 'Unauthorized');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.error = err.error || 'Internal Server Error';

  if (err.name === 'CastError') error = handleCastErrorDB(err);
  if (err.code === 11000) error = handleDuplicateFieldsDB(err);
  if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = new AppError('JSON payload không hợp lệ', 400, 'Bad Request');
  }

  const statusCode = error.statusCode || 500;
  const errorTitle = error.error || (statusCode >= 500 ? 'Internal Server Error' : 'Bad Request');
  const message = error.isOperational
    ? error.message
    : (statusCode >= 500 ? 'Đã xảy ra lỗi máy chủ nội bộ' : error.message);

  return res.status(statusCode).json({
    message,
    error: errorTitle,
    statusCode,
  });
};

module.exports = errorHandler;
