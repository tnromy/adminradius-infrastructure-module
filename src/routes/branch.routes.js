/**
 * Route untuk branch
 */

const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branch.controller');

// Route GET /api/infra/branches
router.get('/branches', branchController.getAllBranches);

// Route GET /api/infra/branch/:id
router.get('/branch/:id', branchController.getBranchById);

// Route POST /api/infra/branch
router.post('/branch', branchController.createBranch);

// Route PUT /api/infra/branch/:id
router.put('/branch/:id', branchController.updateBranch);

// Route DELETE /api/infra/branch/:id
router.delete('/branch/:id', branchController.deleteBranch);

module.exports = router;
