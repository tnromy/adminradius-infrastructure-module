const { connectDB } = require('../conn');

console.log('Dropping infra_types collection...');

const dropInfraTypesCollection = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');

    // Drop collection infra_types
    try {
      await db.collection('infra_types').drop();
      console.log('\n✓ Collection "infra_types" dropped successfully');
    } catch (err) {
      if (err.code === 26) {
        console.log('\nℹ Collection "infra_types" does not exist');
      } else {
        throw err;
      }
    }

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to drop infra_types collection!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan penghapusan collection
dropInfraTypesCollection().catch(console.error); 