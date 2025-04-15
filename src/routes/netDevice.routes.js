/**
 * Route untuk net device
 */

const express = require('express');
const router = express.Router();
const netDeviceRouterController = require('../controllers/netDeviceRouter.controller');
const { validateAddRouter } = require('../validations/netDeviceRouter.validation');

// Route POST /api/infra/branch/:branch_id/router
router.post('/branch/:branch_id/router', validateAddRouter, netDeviceRouterController.addRouterToBranch);

module.exports = router;
