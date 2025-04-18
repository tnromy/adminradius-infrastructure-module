/**
 * Entry point aplikasi
 */

const express = require('express');
const { connectDB } = require('../connections/mongodb_conn');
const routes = require('./routes/index.routes');
const config = require('../config/app.config');
const { initializeJwks } = require('./services/jwks.service');
const { initializeRequestContext } = require('./services/requestContext.service');
const { requestLoggingMiddleware, logError, logInfo } = require('./services/logger.service');

// Inisialisasi aplikasi Express
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize request context untuk setiap request
app.use(initializeRequestContext);

// Logging middleware
app.use(requestLoggingMiddleware);

// Gunakan routes dengan prefix /api/infra
app.use(config.api.prefix, routes);

// 404 handler
app.use((req, res, next) => {
  logError(`Route not found: ${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    statusCode: 404
  });
  
  res.status(404).json({
    error: 'Route not found'
  });
});

// Error handler sederhana
app.use((err, req, res, next) => {
  logError('Internal Server Error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    statusCode: 500
  });
  
  res.status(500).json({
    error: 'Internal Server Error'
  });
});

// Inisialisasi connection pool MongoDB dan JWKS, lalu jalankan server
async function startServer() {
  try {
    // Connect ke MongoDB
    await connectDB();
    logInfo('MongoDB connection pool initialized');

    // Inisialisasi JWKS
    await initializeJwks();
    logInfo('JWKS initialized successfully');

    // Jalankan server
    const PORT = config.server.port;
    const HOST = config.server.host;
    
    app.listen(PORT, HOST, () => {
      logInfo(`Server running on http://${HOST}:${PORT}`, {
        port: PORT,
        host: HOST
      });
      logInfo(`API base URL: ${config.api.prefix}`);
    });
  } catch (error) {
    logError('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Jalankan server
startServer().catch(error => {
  logError('Unhandled error during server startup', {
    error: error.message,
    stack: error.stack
  });
});

// Handle server shutdown
process.on('SIGTERM', () => {
  logInfo('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
