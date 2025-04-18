/**
 * Route untuk net device
 */

const express = require('express');
const router = express.Router();
const netDeviceRouterController = require('../controllers/netDeviceRouter.controller');
const netDeviceOltController = require('../controllers/netDeviceOlt.controller');
const netDeviceOdcController = require('../controllers/netDeviceOdc.controller');
const netDeviceOdpController = require('../controllers/netDeviceOdp.controller');
const netDeviceOntController = require('../controllers/netDeviceOnt.controller');
const { validateAddRouter } = require('../validations/netDeviceRouter.validation');
const { validateAddOlt } = require('../validations/netDeviceOlt.validation');
const { validateAddOdc } = require('../validations/netDeviceOdc.validation');
const { validateAddOdp } = require('../validations/netDeviceOdp.validation');
const { validateAddOnt } = require('../validations/netDeviceOnt.validation');
const { validateDeletedParam, validateScopeLevelParam } = require('../validations/validation.middleware');
const { authenticateJWT, authorizeRoles } = require('../middlewares/auth.middleware');

// Route GET /api/infra/router/:router_id
router.get('/router/:router_id', 
  authenticateJWT,
  authorizeRoles,
  validateDeletedParam, 
  validateScopeLevelParam, 
  netDeviceRouterController.getRouterById
);

// Route GET /api/infra/olt/:olt_id
router.get('/olt/:olt_id', 
  authenticateJWT,
  authorizeRoles,
  validateDeletedParam, 
  validateScopeLevelParam, 
  netDeviceOltController.getOltById
);

// Route GET /api/infra/odc/:odc_id
router.get('/odc/:odc_id', 
  authenticateJWT,
  authorizeRoles,
  validateDeletedParam, 
  validateScopeLevelParam, 
  netDeviceOdcController.getOdcById
);

// Route GET /api/infra/odp/:odp_id
router.get('/odp/:odp_id', 
  authenticateJWT,
  authorizeRoles,
  validateDeletedParam, 
  validateScopeLevelParam, 
  netDeviceOdpController.getOdpById
);

// Route GET /api/infra/ont/:ont_id
router.get('/ont/:ont_id', 
  authenticateJWT,
  authorizeRoles,
  validateDeletedParam, 
  validateScopeLevelParam, 
  netDeviceOntController.getOntById
);

// Route DELETE /api/infra/router/:router_id
router.delete('/router/:router_id', 
  authenticateJWT,
  authorizeRoles,
  netDeviceRouterController.deleteRouter
);

// Route DELETE /api/infra/olt/:olt_id
router.delete('/olt/:olt_id', 
  authenticateJWT,
  authorizeRoles,
  netDeviceOltController.deleteOlt
);

// Route DELETE /api/infra/odc/:odc_id
router.delete('/odc/:odc_id', 
  authenticateJWT,
  authorizeRoles,
  netDeviceOdcController.deleteOdc
);

// Route DELETE /api/infra/odp/:odp_id
router.delete('/odp/:odp_id', 
  authenticateJWT,
  authorizeRoles,
  netDeviceOdpController.deleteOdp
);

// Route DELETE /api/infra/ont/:ont_id
router.delete('/ont/:ont_id', 
  authenticateJWT,
  authorizeRoles,
  netDeviceOntController.deleteOnt
);

// Route POST /api/infra/ont/:ont_id/restore
router.post('/ont/:ont_id/restore', 
  authenticateJWT,
  authorizeRoles,
  netDeviceOntController.restoreOnt
);

// Route POST /api/infra/odp/:odp_id/restore
router.post('/odp/:odp_id/restore', 
  authenticateJWT,
  authorizeRoles,
  netDeviceOdpController.restoreOdp
);

// Route POST /api/infra/odc/:odc_id/restore
router.post('/odc/:odc_id/restore', 
  authenticateJWT,
  authorizeRoles,
  netDeviceOdcController.restoreOdc
);

// Route POST /api/infra/olt/:olt_id/restore
router.post('/olt/:olt_id/restore', 
  authenticateJWT,
  authorizeRoles,
  netDeviceOltController.restoreOlt
);

// Route POST /api/infra/router/:router_id/restore
router.post('/router/:router_id/restore', 
  authenticateJWT,
  authorizeRoles,
  netDeviceRouterController.restoreRouter
);

// Route POST /api/infra/branch/:branch_id/router
router.post('/branch/:branch_id/router', 
  authenticateJWT,
  authorizeRoles,
  validateAddRouter, 
  netDeviceRouterController.addRouterToBranch
);

// Route POST /api/infra/router/:router_id/olt
router.post('/router/:router_id/olt', 
  authenticateJWT,
  authorizeRoles,
  validateAddOlt, 
  netDeviceOltController.addOltToRouter
);

// Route POST /api/infra/olt/:olt_id/odc
router.post('/olt/:olt_id/odc', 
  authenticateJWT,
  authorizeRoles,
  validateAddOdc, 
  netDeviceOdcController.addOdcToOlt
);

// Route POST /api/infra/odc/:odc_id/odp
router.post('/odc/:odc_id/odp', 
  authenticateJWT,
  authorizeRoles,
  validateAddOdp, 
  netDeviceOdpController.addOdpToOdc
);

// Route POST /api/infra/odp/:odp_id/ont
router.post('/odp/:odp_id/ont', 
  authenticateJWT,
  authorizeRoles,
  validateAddOnt, 
  netDeviceOntController.addOntToOdp
);

module.exports = router;
