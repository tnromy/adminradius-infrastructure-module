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
const { 
  requireClientOwner,
  checkBranchListAccess,
  checkDirectBranchAccess,
  checkWritePermission
} = require('../middlewares/permission.middleware');
const config = require('../../config/app.config');

// Route GET /api/infra/branches
router.get('/branches', 
  authenticateJWT,
  authorizeRoles(config.auth.allowedRoles),
  validateDeletedParam, 
  validateScopeLevelParam,
  checkBranchListAccess, // Type A: Filter berdasarkan accessible branches
  branchController.getAllBranches
);

// Route GET /api/infra/branch/:id
router.get('/branch/:id', 
  authenticateJWT,
  authorizeRoles(config.auth.allowedRoles),
  validateBranchId, 
  validateDeletedParam, 
  validateScopeLevelParam,
  checkDirectBranchAccess, // Type B: Check akses ke branch spesifik
  branchController.getBranchById
);

// Route POST /api/infra/branch
router.post('/branch', 
  authenticateJWT,
  authorizeRoles(['Client Owner']), // Hanya Client Owner
  validateCreateBranch, 
  branchController.createBranch
);

// Route PUT /api/infra/branch/:id
router.put('/branch/:id', 
  authenticateJWT,
  authorizeRoles(config.auth.allowedRoles),
  validateUpdateBranch,
  checkWritePermission, // Type C: Check write permission
  branchController.updateBranch
);

// Route DELETE /api/infra/branch/:id
router.delete('/branch/:id', 
  authenticateJWT,
  authorizeRoles(['Client Owner']), // Hanya Client Owner
  validateBranchId, 
  branchController.deleteBranch
);

// Route POST /api/infra/branch/:id/restore
router.post('/branch/:id/restore', 
  authenticateJWT,
  authorizeRoles(['Client Owner']), // Hanya Client Owner
  validateBranchId, 
  branchController.restoreBranch
);

module.exports = router;
