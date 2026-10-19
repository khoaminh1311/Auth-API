const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public routes (Bảo vệ bằng Rate Limiter chống brute-force)
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

// Protected routes (Tất cả người dùng đã đăng nhập)
router.get('/me', authMiddleware, authController.getMe);
router.put('/change-password', authLimiter, authMiddleware, authController.changePassword);
router.post('/logout', authMiddleware, authController.logout);

// RBAC Protected routes (Chỉ người dùng có role admin)
router.get('/admin-only', authMiddleware, authorizeRoles('admin'), (req, res) => {
  res.status(200).json({
    message: 'Truy cập thành công tài nguyên dành riêng cho Admin',
    user: req.user,
  });
});

module.exports = router;
