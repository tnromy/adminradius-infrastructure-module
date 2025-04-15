const { connectDB } = require('../conn');

console.log('Creating infra_types collection...');

const createInfraTypesCollection = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');

    // Buat collection infra_types
    try {
      await db.createCollection('infra_types');
      console.log('\n✓ Collection "infra_types" created successfully');
    } catch (err) {
      if (err.code === 48) {
        console.log('\nℹ Collection "infra_types" already exists');
      } else {
        throw err;
      }
    }

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to create infra_types collection!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan pembuatan collection
createInfraTypesCollection().catch(console.error); 