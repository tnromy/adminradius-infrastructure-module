/**
 * Validasi untuk endpoint net device router
 */

const { body, param, validationResult } = require('express-validator');
const { ConnectionTypes } = require('../entities/netDeviceRouter.entity');

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
 * Custom validation untuk alamat IPv4
 */
const validateIPv4 = (value) => {
  if (typeof value !== 'string') {
    throw new Error('IP address must be a string');
  }
  
  const pattern = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!pattern.test(value)) {
    throw new Error('Invalid IPv4 address format');
  }
  
  return true;
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
 * Validasi untuk menambahkan router ke branch
 */
const validateAddRouter = [
  param('branch_id')
    .isMongoId().withMessage('Invalid branch ID format'),
  
  // Validasi label
  body('label')
    .exists().withMessage('Label is required')
    .isString().withMessage('Label must be a string')
    .isLength({ min: 3 }).withMessage('Label must be at least 3 characters')
    .isLength({ max: 64 }).withMessage('Label must be at most 64 characters')
    .trim()
    .escape(),
  
  // Validasi connection_type
  body('connection_type')
    .exists().withMessage('Connection type is required')
    .isIn(Object.values(ConnectionTypes)).withMessage(`Connection type must be one of: ${Object.values(ConnectionTypes).join(', ')}`),
  
  // Validasi ip_addr
  body('ip_addr')
    .exists().withMessage('IP address is required')
    .custom(validateIPv4),
  
  // Validasi location
  body('location').optional(),
  body('location.type')
    .if(body('location').exists())
    .equals('Point').withMessage('Location type must be Point'),
  body('location.coordinates')
    .if(body('location').exists())
    .custom(validateGeoJSONPoint),
  
  // Validasi address
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
  
  validateResult
];

module.exports = {
  validateAddRouter
}; 