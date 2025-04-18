/**
 * Entry point aplikasi
 */

const express = require('express');
const { connectDB } = require('../connections/mongodb_conn');
const routes = require('./routes/index.routes');
const config = require('../config/app.config');
const { initializeJwks } = require('./services/jwks.service');
const { initializeRequestContext } = require('./services/requestContext.service');

// Inisialisasi aplikasi Express
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware untuk debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Initialize request context untuk setiap request
app.use(initializeRequestContext);

// Gunakan routes dengan prefix /api/infra
app.use(config.api.prefix, routes);

// 404 handler
app.use((req, res, next) => {
  console.log(`[404] Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: 'Route not found'
  });
});

// Error handler sederhana
app.use((err, req, res, next) => {
  console.error(`[Error] ${err.stack}`);
  res.status(500).json({
    error: 'Internal Server Error'
  });
});

// Inisialisasi connection pool MongoDB dan JWKS, lalu jalankan server
async function startServer() {
  try {
    // Connect ke MongoDB
    await connectDB();
    console.log('MongoDB connection pool initialized');

    // Inisialisasi JWKS
    await initializeJwks();
    console.log('JWKS initialized successfully');

    // Jalankan server
    const PORT = config.server.port;
    const HOST = config.server.host;
    
    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
      console.log(`API base URL: ${config.api.prefix}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Jalankan server
startServer().catch(console.error);

// Handle server shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
