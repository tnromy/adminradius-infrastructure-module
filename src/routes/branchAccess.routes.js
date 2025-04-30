/**
 * Routes untuk branch access
 */

const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth.middleware');
const { validateIdToken } = require('../middlewares/idToken.middleware');
const { branchPermission, notHasBranchPermission } = require('../middlewares/branchPermission.middleware');
const {
  validateGetBranchAccessList,
  validateCreateBranchAccess,
  validateUpdateBranchAccess
} = require('../validations/branchAccess.validation');
const {
  getBranchAccessList,
  createBranchAccess,
  updateBranchAccess
} = require('../controllers/branchAccess.controller');

// GET /api/infra/branch-access-list
router.get(
  '/branch-access-list',
  authenticateJWT,
  authorizeRoles(['Client Owner', 'Client Administrator']),
  validateGetBranchAccessList,
  getBranchAccessList
);

// POST /api/infra/branch/:branch_id/access
router.post(
  '/branch/:branch_id/access',
  authenticateJWT,
  authorizeRoles(['Client Owner', 'Client Administrator']),
  validateCreateBranchAccess,
  notHasBranchPermission,
  validateIdToken,
  createBranchAccess
);

// PUT /api/infra/branch-access/:branch_access_id
router.put(
  '/branch-access/:branch_access_id',
  authenticateJWT,
  authorizeRoles(['Client Owner']),
  validateUpdateBranchAccess,
  branchPermission,
  updateBranchAccess
);

module.exports = router; 