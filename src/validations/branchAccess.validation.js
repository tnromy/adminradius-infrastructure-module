const { body, param, query, validationResult } = require('express-validator');
const { ObjectId } = require('mongodb');
const { getCollection } = require('../repositories/database.connector');
const { logError } = require('../services/logger.service');

/**
 * Custom validation untuk memeriksa keberadaan branch
 */
const validateBranchExists = async (value) => {
  try {
    const collection = getCollection('branches');
    const branch = await collection.findOne({ 
      _id: new ObjectId(value),
      deleted: { $ne: true }
    });
    
    if (!branch) {
      throw new Error('Branch not found');
    }
    return true;
  } catch (error) {
    logError('Error validating branch existence', {
      branchId: value,
      error: error.message
    });
    throw new Error('Invalid branch ID');
  }
};

/**
 * Middleware untuk validasi hasil
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
 * Validasi untuk mendapatkan daftar branch access
 */
const validateGetBranchAccessList = [
  query('status')
    .optional()
    .isIn(['SUBMITTED', 'APPROVED', 'REJECTED', 'REVOKED'])
    .withMessage('Status must be one of: SUBMITTED, APPROVED, REJECTED, REVOKED'),
  validateResult
];

/**
 * Validasi untuk membuat branch access request
 */
const validateCreateBranchAccess = [
  param('branch_id')
    .isMongoId()
    .withMessage('Invalid branch ID format')
    .custom(validateBranchExists)
    .withMessage('Branch not found or invalid'),
  
  body('id_token')
    .exists()
    .withMessage('ID token is required')
    .isJWT()
    .withMessage('Invalid ID token format'),
    
  body('user_note')
    .optional()
    .isString()
    .withMessage('User note must be a string')
    .trim()
    .escape(),
    
  validateResult
];

/**
 * Validasi untuk mengupdate branch access
 */
const validateUpdateBranchAccess = [
  param('branch_access_id')
    .isMongoId()
    .withMessage('Invalid branch access ID format'),
    
  body('status')
    .exists()
    .withMessage('Status is required')
    .isIn(['APPROVED', 'REJECTED'])
    .withMessage('Status must be one of: APPROVED, REJECTED'),
    
  body('permission')
    .exists()
    .withMessage('Permission is required')
    .isIn(['R', 'RW'])
    .withMessage('Permission must be one of: R, RW'),
    
  body('reviewer_note')
    .optional()
    .isString()
    .withMessage('Reviewer note must be a string')
    .trim()
    .escape(),
    
  validateResult
];

module.exports = {
  validateGetBranchAccessList,
  validateCreateBranchAccess,
  validateUpdateBranchAccess
}; 