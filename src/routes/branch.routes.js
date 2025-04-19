/**
 * Route untuk branch
 */

const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branch.controller');
const { 
  validateCreateBranch, 
  validateBranchId, 
  validateUpdateBranch 
} = require('../validations/branch.validation');
const { validateDeletedParam, validateScopeLevelParam } = require('../validations/validation.middleware');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth.middleware');
const config = require('../../config/app.config');

// Route GET /api/infra/branches
router.get('/branches', 
  authenticateJWT,
  authorizeRoles(config.auth.allowedRoles),
  validateDeletedParam, 
  validateScopeLevelParam, 
  branchController.getAllBranches
);

// Route GET /api/infra/branch/:id
router.get('/branch/:id', 
  authenticateJWT,
  authorizeRoles(config.auth.allowedRoles),
  validateBranchId, 
  validateDeletedParam, 
  validateScopeLevelParam, 
  branchController.getBranchById
);

// Route POST /api/infra/branch
router.post('/branch', 
  authenticateJWT,
  authorizeRoles(config.auth.allowedRoles),
  validateCreateBranch, 
  branchController.createBranch
);

// Route PUT /api/infra/branch/:id
router.put('/branch/:id', 
  authenticateJWT,
  authorizeRoles(config.auth.allowedRoles),
  validateUpdateBranch, 
  branchController.updateBranch
);

// Route DELETE /api/infra/branch/:id
router.delete('/branch/:id', 
  authenticateJWT,
  authorizeRoles(config.auth.allowedRoles),
  validateBranchId, 
  branchController.deleteBranch
);

// Route POST /api/infra/branch/:id/restore
router.post('/branch/:id/restore', 
  authenticateJWT,
  authorizeRoles(config.auth.allowedRoles),
  validateBranchId, 
  branchController.restoreBranch
);

module.exports = router;
