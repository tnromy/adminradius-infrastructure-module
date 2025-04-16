/**
 * Route untuk net device
 */

const express = require('express');
const router = express.Router();
const netDeviceRouterController = require('../controllers/netDeviceRouter.controller');
const netDeviceOltController = require('../controllers/netDeviceOlt.controller');
const netDeviceOdcController = require('../controllers/netDeviceOdc.controller');
const { validateAddRouter } = require('../validations/netDeviceRouter.validation');
const { validateAddOlt } = require('../validations/netDeviceOlt.validation');
const { validateAddOdc } = require('../validations/netDeviceOdc.validation');

// Route POST /api/infra/branch/:branch_id/router
router.post('/branch/:branch_id/router', validateAddRouter, netDeviceRouterController.addRouterToBranch);

// Route POST /api/infra/router/:router_id/olt
router.post('/router/:router_id/olt', validateAddOlt, netDeviceOltController.addOltToRouter);

// Route POST /api/infra/olt/:olt_id/odc
router.post('/olt/:olt_id/odc', validateAddOdc, netDeviceOdcController.addOdcToOlt);

module.exports = router;
