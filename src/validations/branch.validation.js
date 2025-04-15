/**
 * Validasi untuk endpoint branch
 */

const { body, param, validationResult } = require('express-validator');
const { sanitizeFilter } = require('express-validator');

/**
 * Middleware untuk validasi hasil
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next function
 */
const validateResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * Validasi untuk membuat branch baru
 */
const validateCreateBranch = [
  body('name')
    .exists().withMessage('Name is required')
    .isString().withMessage('Name must be a string')
    .isLength({ min: 3 }).withMessage('Name must be at least 3 characters')
    .isLength({ max: 64 }).withMessage('Name must be at most 64 characters')
    .trim()
    .escape(),
  validateResult
];

/**
 * Validasi untuk mendapatkan branch berdasarkan ID
 */
const validateBranchId = [
  param('id')
    .isMongoId().withMessage('Invalid branch ID format'),
  validateResult
];

/**
 * Validasi untuk mengupdate branch
 */
const validateUpdateBranch = [
  param('id')
    .isMongoId().withMessage('Invalid branch ID format'),
  body('name')
    .optional()
    .isString().withMessage('Name must be a string')
    .isLength({ min: 3 }).withMessage('Name must be at least 3 characters')
    .isLength({ max: 64 }).withMessage('Name must be at most 64 characters')
    .trim()
    .escape(),
  validateResult
];

module.exports = {
  validateCreateBranch,
  validateBranchId,
  validateUpdateBranch
};
