/**
 * File indeks untuk semua rute API
 */

const express = require('express');
const router = express.Router();
const branchRoutes = require('./branch.routes');
const netDeviceRoutes = require('./netDevice.routes');

// Gunakan route branch untuk path /api/infra
router.use('/infra', branchRoutes);

// Gunakan route net device untuk path /api/infra
router.use('/infra', netDeviceRoutes);

module.exports = router;
