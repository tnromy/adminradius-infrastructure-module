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

// Route GET /api/infra/router/:router_id
router.get('/router/:router_id', validateDeletedParam, validateScopeLevelParam, netDeviceRouterController.getRouterById);

// Route GET /api/infra/olt/:olt_id
router.get('/olt/:olt_id', validateDeletedParam, validateScopeLevelParam, netDeviceOltController.getOltById);

// Route GET /api/infra/odc/:odc_id
router.get('/odc/:odc_id', validateDeletedParam, validateScopeLevelParam, netDeviceOdcController.getOdcById);

// Route GET /api/infra/odp/:odp_id
router.get('/odp/:odp_id', validateDeletedParam, validateScopeLevelParam, netDeviceOdpController.getOdpById);

// Route GET /api/infra/ont/:ont_id
router.get('/ont/:ont_id', validateDeletedParam, validateScopeLevelParam, netDeviceOntController.getOntById);

// Route DELETE /api/infra/router/:router_id
router.delete('/router/:router_id', netDeviceRouterController.deleteRouter);

// Route DELETE /api/infra/olt/:olt_id
router.delete('/olt/:olt_id', netDeviceOltController.deleteOlt);

// Route DELETE /api/infra/odc/:odc_id
router.delete('/odc/:odc_id', netDeviceOdcController.deleteOdc);

// Route DELETE /api/infra/odp/:odp_id
router.delete('/odp/:odp_id', netDeviceOdpController.deleteOdp);

// Route DELETE /api/infra/ont/:ont_id
router.delete('/ont/:ont_id', netDeviceOntController.deleteOnt);

// Route POST /api/infra/ont/:ont_id/restore
router.post('/ont/:ont_id/restore', netDeviceOntController.restoreOnt);

// Route POST /api/infra/odp/:odp_id/restore
router.post('/odp/:odp_id/restore', netDeviceOdpController.restoreOdp);

// Route POST /api/infra/odc/:odc_id/restore
router.post('/odc/:odc_id/restore', netDeviceOdcController.restoreOdc);

// Route POST /api/infra/olt/:olt_id/restore
router.post('/olt/:olt_id/restore', netDeviceOltController.restoreOlt);

// Route POST /api/infra/branch/:branch_id/router
router.post('/branch/:branch_id/router', validateAddRouter, netDeviceRouterController.addRouterToBranch);

// Route POST /api/infra/router/:router_id/olt
router.post('/router/:router_id/olt', validateAddOlt, netDeviceOltController.addOltToRouter);

// Route POST /api/infra/olt/:olt_id/odc
router.post('/olt/:olt_id/odc', validateAddOdc, netDeviceOdcController.addOdcToOlt);

// Route POST /api/infra/odc/:odc_id/odp
router.post('/odc/:odc_id/odp', validateAddOdp, netDeviceOdpController.addOdpToOdc);

// Route POST /api/infra/odp/:odp_id/ont
router.post('/odp/:odp_id/ont', validateAddOnt, netDeviceOntController.addOntToOdp);

module.exports = router;
