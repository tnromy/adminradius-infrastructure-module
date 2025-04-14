const mongoose = require('mongoose');
require('dotenv').config();

let connection = null;

const connectDB = async () => {
  try {
    if (connection) return connection;

    const options = {
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '5'),
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50'),
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true
    };

    console.log('Connecting to MongoDB...', {
      host: process.env.MONGO_HOST,
      user: process.env.MONGO_USER,
      port: process.env.MONGO_PORT,
      poolSize: `${options.minPoolSize}-${options.maxPoolSize}`
    });

    connection = await mongoose.connect(process.env.MONGODB_URI, options);

    mongoose.connection.on('connected', () => {
      console.log('MongoDB connection established successfully');
      console.log('Active connections:', mongoose.connection.base.connections.length);
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      // Attempt to reconnect
      setTimeout(() => {
        console.log('Attempting to reconnect to MongoDB...');
        mongoose.connect(process.env.MONGODB_URI, options).catch(err => {
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
