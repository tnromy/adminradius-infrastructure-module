/**
 * Middleware validasi umum menggunakan express-validator
 */

const { validationResult, query } = require('express-validator');

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

/**
 * Middleware untuk memvalidasi parameter deleted
 * ONLY - Hanya menampilkan data yang memiliki property deleted_at
 * WITH - Menampilkan semua data, termasuk yang memiliki property deleted_at
 * WITHOUT - Hanya menampilkan data yang tidak memiliki property deleted_at (default)
 */
const validateDeletedParam = [
  query('deleted')
    .optional()
    .isIn(['ONLY', 'WITH', 'WITHOUT'])
    .withMessage('Parameter deleted harus bernilai ONLY, WITH, atau WITHOUT'),
  validationMiddleware
];

module.exports = {
  validationMiddleware,
  validateDeletedParam
}; 