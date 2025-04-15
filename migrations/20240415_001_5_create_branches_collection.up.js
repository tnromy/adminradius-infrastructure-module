const { connectDB } = require('../connections/mongodb_conn');

console.log('Creating branches collection...');

const createBranchesCollection = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');

    // Buat collection branches
    try {
      await db.createCollection('branches');
      console.log('\n✓ Collection "branches" created successfully');
    } catch (err) {
      if (err.code === 48) {
        console.log('\nℹ Collection "branches" already exists');
      } else {
        throw err;
      }
    }

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to create branches collection!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan pembuatan collection
createBranchesCollection().catch(console.error); 