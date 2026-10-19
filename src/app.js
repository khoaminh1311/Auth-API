const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const AppError = require('./utils/appError');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Hardening: Thiết lập các HTTP security headers chuẩn OWASP & ẩn X-Powered-By
app.use(helmet());

// Middlewares
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '10kb' }));

const authRoutes = require('./routes/authRoutes');

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Unhandled routes -> 404 Not Found
app.all('*', (req, res, next) => {
  next(new AppError(`Không tìm thấy tuyến đường: ${req.originalUrl}`, 404, 'Not Found'));
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
