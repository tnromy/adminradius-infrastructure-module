/**
 * Validasi untuk endpoint terkait ONT
 */

const { body, param } = require('express-validator');
const { validationMiddleware } = require('./validation.middleware');

// Validasi untuk operasi menambahkan ONT ke ODP
const validateAddOnt = [
  // Validasi odp_id pada parameter
  param('odp_id')
    .notEmpty().withMessage('odp_id is required')
    .isMongoId().withMessage('odp_id must be a valid MongoDB ID'),
  
  // Validasi data dasar ONT
  body('label')
    .notEmpty().withMessage('label is required')
    .isString().withMessage('label must be a string'),
  
  // Validasi vendor
  body('vendor')
    .notEmpty().withMessage('vendor is required')
    .isString().withMessage('vendor must be a string'),
  
  // Validasi model
  body('model')
    .notEmpty().withMessage('model is required')
    .isString().withMessage('model must be a string'),
  
  // Validasi serial number
  body('sn')
    .notEmpty().withMessage('sn is required')
    .isString().withMessage('sn must be a string'),
  
  // Validasi location (format GeoJSON Point)
  body('location')
    .optional()
    .isObject().withMessage('location must be an object'),
  
  body('location.type')
    .if(body('location').exists())
    .equals('Point').withMessage('location.type must be "Point"'),
  
  body('location.coordinates')
    .if(body('location').exists())
    .isArray({ min: 2, max: 2 }).withMessage('location.coordinates must be an array with exactly 2 elements [longitude, latitude]'),
  
  body('location.coordinates.0')
    .if(body('location').exists())
    .isFloat({ min: -180, max: 180 }).withMessage('longitude must be between -180 and 180'),
  
  body('location.coordinates.1')
    .if(body('location').exists())
    .isFloat({ min: -90, max: 90 }).withMessage('latitude must be between -90 and 90'),
  
  // Validasi address
  body('address')
    .optional()
    .isObject().withMessage('address must be an object'),
  
  body('address.country')
    .if(body('address').exists())
    .isString().withMessage('address.country must be a string'),
  
  body('address.province')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('address.province must be a string'),
  
  body('address.city')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('address.city must be a string'),
  
  body('address.district')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('address.district must be a string'),
  
  body('address.village')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('address.village must be a string'),
  
  body('address.detail')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('address.detail must be a string'),
  
  body('address.zip_code')
    .if(body('address').exists())
    .optional()
    .isString().withMessage('address.zip_code must be a string'),
  
  // Apply validation middleware
  validationMiddleware
];

module.exports = {
  validateAddOnt
}; 