/**
 * Validasi untuk endpoint terkait ODP
 */

const { body, param } = require('express-validator');
const { validationMiddleware } = require('./validation.middleware');

// Validasi untuk operasi menambahkan ODP ke ODC
const validateAddOdp = [
  // Validasi odc_id pada parameter
  param('odc_id')
    .notEmpty().withMessage('odc_id is required')
    .isMongoId().withMessage('odc_id must be a valid MongoDB ID'),
  
  // Validasi data dasar ODP
  body('label')
    .notEmpty().withMessage('label is required')
    .isString().withMessage('label must be a string'),
  
  // Validasi tray pada ODC
  body('tray')
    .notEmpty().withMessage('tray is required')
    .isInt({ min: 1 }).withMessage('tray must be a positive integer'),
  
  // Validasi core_on_odc_tray
  body('core_on_odc_tray')
    .notEmpty().withMessage('core_on_odc_tray is required')
    .isInt({ min: 1 }).withMessage('core_on_odc_tray must be a positive integer'),
  
  // Validasi available_port
  body('available_port')
    .notEmpty().withMessage('available_port is required')
    .isInt({ min: 0 }).withMessage('available_port must be a non-negative integer'),
  
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
  validateAddOdp
}; 