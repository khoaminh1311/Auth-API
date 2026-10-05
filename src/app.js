const express = require('express');
const cors = require('cors');
const AppError = require('./utils/appError');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Placeholder for auth routes (will mount in subsequent phases)
// app.use('/api/auth', authRoutes);

// Unhandled routes -> 404 Not Found
app.all('*', (req, res, next) => {
  next(new AppError(`Không tìm thấy tuyến đường: ${req.originalUrl}`, 404, 'Not Found'));
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
