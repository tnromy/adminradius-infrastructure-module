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

// Route GET /api/infra/branches
router.get('/branches', validateDeletedParam, validateScopeLevelParam, branchController.getAllBranches);

// Route GET /api/infra/branch/:id
router.get('/branch/:id', validateBranchId, validateDeletedParam, validateScopeLevelParam, branchController.getBranchById);

// Route POST /api/infra/branch
router.post('/branch', validateCreateBranch, branchController.createBranch);

// Route PUT /api/infra/branch/:id
router.put('/branch/:id', validateUpdateBranch, branchController.updateBranch);

// Route DELETE /api/infra/branch/:id
router.delete('/branch/:id', validateBranchId, branchController.deleteBranch);

// Route POST /api/infra/branch/:id/restore
router.post('/branch/:id/restore', validateBranchId, branchController.restoreBranch);

module.exports = router;
