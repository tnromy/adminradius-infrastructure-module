const { connectDB } = require('../conn');

console.log('Dropping infras collection...');

const dropInfrasCollection = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');

    // Drop collection infras
    try {
      await db.collection('infras').drop();
      console.log('\n✓ Collection "infras" dropped successfully');
    } catch (err) {
      if (err.code === 26) {
        console.log('\nℹ Collection "infras" does not exist');
      } else {
        throw err;
      }
    }

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to drop infras collection!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan penghapusan collection
dropInfrasCollection().catch(console.error); 