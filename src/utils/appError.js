class AppError extends Error {
  constructor(message, statusCode, error = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    if (error) {
      this.error = error;
    } else {
      switch (statusCode) {
        case 400:
          this.error = 'Bad Request';
          break;
        case 401:
          this.error = 'Unauthorized';
          break;
        case 403:
          this.error = 'Forbidden';
          break;
        case 404:
          this.error = 'Not Found';
          break;
        case 409:
          this.error = 'Conflict';
          break;
        case 422:
          this.error = 'Unprocessable Entity';
          break;
        default:
          this.error = 'Internal Server Error';
      }
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
