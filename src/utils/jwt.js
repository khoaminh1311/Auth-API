const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Tạo và ký JSON Web Token với payload là định danh user
 * @param {string|ObjectId} userId
 * @returns {string} Token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId.toString() }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

/**
 * Xác minh tính hợp lệ của token
 * @param {string} token
 * @returns {Promise<object>} Decoded payload
 */
const verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
};

module.exports = {
  generateToken,
  verifyToken,
};
