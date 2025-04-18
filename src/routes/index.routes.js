/**
 * Index untuk semua routes
 */

const express = require('express');
const router = express.Router();
const branchRoutes = require('./branch.routes');
const netDeviceRoutes = require('./netDevice.routes');

// Register semua routes
router.use(branchRoutes);
router.use(netDeviceRoutes);

module.exports = router;
