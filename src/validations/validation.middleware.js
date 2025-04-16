/**
 * Middleware validasi umum menggunakan express-validator
 */

const { validationResult } = require('express-validator');

/**
 * Middleware untuk memeriksa validasi dan mengirimkan respons error jika ada
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const validationMiddleware = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation error', 
      details: errors.array() 
    });
  }
  next();
};

module.exports = {
  validationMiddleware
}; 