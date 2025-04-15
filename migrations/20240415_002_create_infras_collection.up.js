const { connectDB } = require('../conn');

console.log('Creating infras collection...');

const createInfrasCollection = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');

    // Buat collection infras
    try {
      await db.createCollection('infras');
      console.log('\n✓ Collection "infras" created successfully');
    } catch (err) {
      if (err.code === 48) {
        console.log('\nℹ Collection "infras" already exists');
      } else {
        throw err;
      }
    }

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to create infras collection!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan pembuatan collection
createInfrasCollection().catch(console.error); 