const mongoose = require('mongoose');
const dbConfig = require('../config/database.config');

let connection = null;

const connectDB = async () => {
  try {
    if (connection) return connection;

    console.log('Connecting to MongoDB...', {
      host: dbConfig.host,
      user: dbConfig.user,
      port: dbConfig.port,
      poolSize: `${dbConfig.options.minPoolSize}-${dbConfig.options.maxPoolSize}`
    });

    connection = await mongoose.connect(dbConfig.uri, dbConfig.options);

    mongoose.connection.on('connected', () => {
      console.log('MongoDB connection established successfully');
      console.log('Active connections:', mongoose.connection.base.connections.length);
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      // Attempt to reconnect
      setTimeout(() => {
        console.log('Attempting to reconnect to MongoDB...');
        mongoose.connect(dbConfig.uri, dbConfig.options).catch(err => {
          console.error('Reconnection failed:', err);
        });
      }, 5000);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB connection disconnected');
    });

    // Monitor pool size
    setInterval(() => {
      const numConnections = mongoose.connection.base.connections.length;
      console.log(`Current active connections: ${numConnections}`);
    }, 300000); // Log every 5 minutes

    // Handle application termination
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to application termination');
      process.exit(0);
    });

    return connection;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

module.exports = {
  connectDB,
  getConnection: () => connection
};
