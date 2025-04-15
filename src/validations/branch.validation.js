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
 * Custom validation untuk koordinat GeoJSON
 */
const validateGeoJSONPoint = (value) => {
  if (!value || !Array.isArray(value) || value.length !== 2) {
    throw new Error('Coordinates must be an array with exactly 2 elements');
  }
  
  const [longitude, latitude] = value;
  
  if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }
  
  if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }
  
  return true;
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
  
  body('location').optional(),
  body('location.type')
    .if(body('location').exists())
    .equals('Point').withMessage('Location type must be Point'),
  body('location.coordinates')
    .if(body('location').exists())
    .custom(validateGeoJSONPoint),
  
  body('address').optional(),
  body('address.country')
    .if(body('address').exists())
    .isString().withMessage('Country must be a string')
    .isLength({ min: 2, max: 2 }).withMessage('Country code must be 2 characters')
    .trim()
    .escape(),
  body('address.province')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('Province must be a string')
    .trim()
    .escape(),
  body('address.city')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('City must be a string')
    .trim()
    .escape(),
  body('address.district')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('District must be a string')
    .trim()
    .escape(),
  body('address.village')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('Village must be a string')
    .trim()
    .escape(),
  body('address.detail')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('Detail must be a string')
    .trim()
    .escape(),
  body('address.zip_code')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('Zip code must be a string')
    .trim()
    .escape(),
  
  body('contact').optional(),
  body('contact.email')
    .if(body('contact').exists())
    .optional()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('contact.phone')
    .if(body('contact').exists())
    .optional()
    .matches(/^\+?[0-9]{8,15}$/).withMessage('Invalid phone number format')
    .trim(),
  
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
  
  body('location').optional(),
  body('location.type')
    .if(body('location').exists())
    .equals('Point').withMessage('Location type must be Point'),
  body('location.coordinates')
    .if(body('location').exists())
    .custom(validateGeoJSONPoint),
  
  body('address').optional(),
  body('address.country')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('Country must be a string')
    .isLength({ min: 2, max: 2 }).withMessage('Country code must be 2 characters')
    .trim()
    .escape(),
  body('address.province')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('Province must be a string')
    .trim()
    .escape(),
  body('address.city')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('City must be a string')
    .trim()
    .escape(),
  body('address.district')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('District must be a string')
    .trim()
    .escape(),
  body('address.village')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('Village must be a string')
    .trim()
    .escape(),
  body('address.detail')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('Detail must be a string')
    .trim()
    .escape(),
  body('address.zip_code')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('Zip code must be a string')
    .trim()
    .escape(),
  
  body('contact').optional(),
  body('contact.email')
    .if(body('contact').exists())
    .optional()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('contact.phone')
    .if(body('contact').exists())
    .optional()
    .matches(/^\+?[0-9]{8,15}$/).withMessage('Invalid phone number format')
    .trim(),
    
  validateResult
];

module.exports = {
  validateCreateBranch,
  validateBranchId,
  validateUpdateBranch
};
