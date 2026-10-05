/**
 * Wrapper bắt lỗi async và chuyển tiếp tới errorHandler middleware
 * @param {Function} fn
 * @returns {Function} Express middleware function
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;
