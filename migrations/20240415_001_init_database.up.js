const { connectDB } = require('../connections/mongodb_conn');

console.log('Initializing database...');

const initDatabase = async () => {
  try {
    const connection = await connectDB();
    
    // Cek status koneksi
    const state = connection.connection.readyState;
    console.log('\nConnection Status:');
    console.log('----------------');
    console.log(`Ready State: ${state === 1 ? 'Connected' : 'Disconnected'}`);
    console.log(`Database Host: ${connection.connection.host}`);
    console.log(`Database Port: ${connection.connection.port}`);
    
    // Buat atau gunakan database adminradius
    const db = connection.connection.useDb('adminradius');
    console.log('\n✓ Database "adminradius" initialized successfully');

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Database initialization failed!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan inisialisasi
initDatabase().catch(console.error); 