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

/**
 * Middleware untuk memvalidasi parameter scope_level
 * BRANCHES - Hanya data branch tanpa children
 * ROUTERS - Data branch dengan router tanpa children
 * OLTS - Data branch dengan router dan OLT (tanpa children di pon_port)
 * ODCS - Data branch dengan router, OLT, dan ODC (tanpa children di tray)
 * ODPS - Data branch dengan router, OLT, ODC, dan ODP (tanpa children)
 */
const validateScopeLevelParam = [
  query('scope_level')
    .optional()
    .isIn(['BRANCHES', 'ROUTERS', 'OLTS', 'ODCS', 'ODPS', 'ONTS'])
    .withMessage('Parameter scope_level harus bernilai BRANCHES, ROUTERS, OLTS, ODCS, ODPS, atau ONTS'),
  validationMiddleware
];

module.exports = {
  validationMiddleware,
  validateDeletedParam,
  validateScopeLevelParam
}; 