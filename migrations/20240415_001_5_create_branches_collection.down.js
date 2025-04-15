const { connectDB } = require('../connections/mongodb_conn');

console.log('Dropping branches collection...');

const dropBranchesCollection = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');

    // Drop collection branches
    try {
      await db.collection('branches').drop();
      console.log('\n✓ Collection "branches" dropped successfully');
    } catch (err) {
      if (err.code === 26) {
        console.log('\nℹ Collection "branches" does not exist');
      } else {
        throw err;
      }
    }

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to drop branches collection!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan penghapusan collection
dropBranchesCollection().catch(console.error); 