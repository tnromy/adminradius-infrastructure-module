/**
 * Entry point aplikasi
 */

const express = require('express');
const { connectDB } = require('../connections/mongodb_conn');
const routes = require('./routes/index.routes');
const config = require('./config/app.config');

// Inisialisasi aplikasi Express
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gunakan routes dengan prefix /api
app.use(config.api.prefix, routes);

// Error handler sederhana
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error'
  });
});

// Inisialisasi connection pool MongoDB dan jalankan server
async function startServer() {
  try {
    // Connect ke MongoDB
    await connectDB();
    console.log('MongoDB connection pool initialized');

    // Jalankan server
    const PORT = config.server.port;
    const HOST = config.server.host;
    
    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
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
