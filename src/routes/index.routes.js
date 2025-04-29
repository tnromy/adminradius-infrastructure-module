/**
 * Index untuk semua routes
 */

const express = require('express');
const router = express.Router();
const branchRoutes = require('./branch.routes');
const netDeviceRoutes = require('./netDevice.routes');
const branchAccessRoutes = require('./branchAccess.routes');

// Register semua routes
router.use(branchRoutes);
router.use(netDeviceRoutes);
router.use(branchAccessRoutes);

module.exports = router;
