const { connectDB } = require('../connections/mongodb_conn');

console.log('Dropping database...');

const dropDatabase = async () => {
  try {
    const connection = await connectDB();
    
    // Drop database adminradius
    try {
      await connection.connection.useDb('adminradius').dropDatabase();
      console.log('\n✓ Database "adminradius" dropped successfully');
    } catch (err) {
      console.error('\n❌ Failed to drop database:', err);
      throw err;
    }

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to drop database!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan penghapusan database
dropDatabase().catch(console.error); 