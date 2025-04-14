const { connectDB } = require('./conn');

console.log('Initializing database connection test...');

const testConnection = async () => {
  try {
    const connection = await connectDB();
    
    // Cek status koneksi
    const state = connection.connection.readyState;
    console.log('\nConnection Status:');
    console.log('----------------');
    console.log(`Ready State: ${state === 1 ? 'Connected' : 'Disconnected'}`);
    console.log(`Database Name: ${connection.connection.name}`);
    console.log(`Database Host: ${connection.connection.host}`);
    console.log(`Database Port: ${connection.connection.port}`);
    
    // Cek informasi pool
    const poolSize = connection.connection.client.topology.s.options.maxPoolSize;
    const minPoolSize = connection.connection.client.topology.s.options.minPoolSize;
    console.log('\nConnection Pool Info:');
    console.log('-------------------');
    console.log(`Min Pool Size: ${minPoolSize}`);
    console.log(`Max Pool Size: ${poolSize}`);
    console.log(`Current Active Connections: ${connection.connection.base.connections.length}`);

    console.log('\n✅ Database connection test successful!');
    
  } catch (error) {
    console.error('\n❌ Database connection test failed!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan test
testConnection().catch(console.error); 