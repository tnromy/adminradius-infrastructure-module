/**
 * File indeks untuk semua rute API
 */

const express = require('express');
const router = express.Router();
const branchRoutes = require('./branch.routes');

// Gunakan route branch untuk path /api/infra
router.use('/infra', branchRoutes);

module.exports = router;
