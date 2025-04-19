/**
 * Validasi untuk endpoint terkait OLT
 */

const { body, param } = require('express-validator');
const { validationMiddleware } = require('./validation.middleware');
const { PonTypes } = require('../entities/netDeviceOlt.entity');

// Validasi untuk operasi menambahkan OLT ke router
const validateAddOlt = [
  // Validasi router_id pada parameter
  param('router_id')
    .notEmpty().withMessage('router_id is required')
    .isMongoId().withMessage('router_id must be a valid MongoDB ID'),
  
  // Validasi data dasar OLT
  body('label')
    .notEmpty().withMessage('label is required')
    .isString().withMessage('label must be a string'),
  
  body('available_pon')
    .notEmpty().withMessage('available_pon is required')
    .isInt({ min: 1, max: 128 }).withMessage('available_pon must be between 1 and 128'),
  
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
  
  // Validasi pon_type
  body('pon_type')
    .notEmpty().withMessage('pon_type is required')
    .isIn(Object.values(PonTypes)).withMessage('pon_type must be either GPON or EPON'),
  
  // Validasi telnet_conn jika ada
  body('telnet_conn')
    .optional()
    .isObject().withMessage('telnet_conn must be an object'),
  
  body('telnet_conn.ip_addr')
    .if(body('telnet_conn').exists())
    .notEmpty().withMessage('telnet_conn.ip_addr is required')
    .isIP(4).withMessage('telnet_conn.ip_addr must be a valid IPv4 address'),
  
  body('telnet_conn.port')
    .if(body('telnet_conn').exists())
    .notEmpty().withMessage('telnet_conn.port is required')
    .isInt({ min: 1, max: 65535 }).withMessage('telnet_conn.port must be a valid port number'),
  
  body('telnet_conn.username')
    .if(body('telnet_conn').exists())
    .notEmpty().withMessage('telnet_conn.username is required')
    .isString().withMessage('telnet_conn.username must be a string'),
  
  body('telnet_conn.password')
    .if(body('telnet_conn').exists())
    .notEmpty().withMessage('telnet_conn.password is required')
    .isString().withMessage('telnet_conn.password must be a string'),
  
  // Validasi ssh_conn jika ada
  body('ssh_conn')
    .optional()
    .isObject().withMessage('ssh_conn must be an object'),
  
  body('ssh_conn.ip_addr')
    .if(body('ssh_conn').exists())
    .notEmpty().withMessage('ssh_conn.ip_addr is required')
    .isIP(4).withMessage('ssh_conn.ip_addr must be a valid IPv4 address'),
  
  body('ssh_conn.port')
    .if(body('ssh_conn').exists())
    .notEmpty().withMessage('ssh_conn.port is required')
    .isInt({ min: 1, max: 65535 }).withMessage('ssh_conn.port must be a valid port number'),
  
  body('ssh_conn.username')
    .if(body('ssh_conn').exists())
    .notEmpty().withMessage('ssh_conn.username is required')
    .isString().withMessage('ssh_conn.username must be a string'),
  
  body('ssh_conn.password')
    .if(body('ssh_conn').exists())
    .notEmpty().withMessage('ssh_conn.password is required')
    .isString().withMessage('ssh_conn.password must be a string'),
  
  // Validasi snmp_conn jika ada
  body('snmp_conn')
    .optional()
    .isObject().withMessage('snmp_conn must be an object'),
  
  body('snmp_conn.ip_addr')
    .if(body('snmp_conn').exists())
    .notEmpty().withMessage('snmp_conn.ip_addr is required')
    .isIP(4).withMessage('snmp_conn.ip_addr must be a valid IPv4 address'),
  
  body('snmp_conn.port')
    .if(body('snmp_conn').exists())
    .notEmpty().withMessage('snmp_conn.port is required')
    .isInt({ min: 1, max: 65535 }).withMessage('snmp_conn.port must be a valid port number'),
  
  body('snmp_conn.community_read')
    .if(body('snmp_conn').exists())
    .notEmpty().withMessage('snmp_conn.community_read is required')
    .isString().withMessage('snmp_conn.community_read must be a string'),
  
  body('snmp_conn.community_write')
    .if(body('snmp_conn').exists())
    .notEmpty().withMessage('snmp_conn.community_write is required')
    .isString().withMessage('snmp_conn.community_write must be a string'),
  
  // Apply validation middleware
  validationMiddleware
];

module.exports = {
  validateAddOlt
}; 