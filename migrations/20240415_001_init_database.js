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

    // Inisialisasi Database dan Collections
    console.log('\nInitializing Database and Collections:');
    console.log('------------------------------------');
    
    // Buat atau gunakan database adminradius
    const db = connection.connection.useDb('adminradius');
    console.log('✓ Database "adminradius" selected');

    // Buat collections
    try {
      await db.createCollection('infras');
      console.log('✓ Collection "infras" created');
    } catch (err) {
      if (err.code === 48) { // Collection already exists
        console.log('ℹ Collection "infras" already exists');
      } else {
        throw err;
      }
    }

    try {
      await db.createCollection('infra_types');
      console.log('✓ Collection "infra_types" created');
    } catch (err) {
      if (err.code === 48) { // Collection already exists
        console.log('ℹ Collection "infra_types" already exists');
      } else {
        throw err;
      }
    }

    // Tampilkan daftar collections yang ada
    const collections = await db.db.listCollections().toArray();
    console.log('\nExisting Collections:');
    console.log('-------------------');
    collections.forEach(collection => {
      console.log(`• ${collection.name}`);
    });

    console.log('\n✅ Database initialization successful!');
    
    // Tutup koneksi setelah selesai
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Database initialization failed!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan test
testConnection().catch(console.error); 