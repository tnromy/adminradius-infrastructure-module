const { connectDB } = require('../connections/mongodb_conn');

console.log('Dropping branch_access collection...');

const dropBranchAccessCollection = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');

    // Drop collection branch_access
    try {
      await db.collection('branch_access').drop();
      console.log('\n✓ Collection "branch_access" dropped successfully');
    } catch (err) {
      if (err.code === 26) {
        console.log('\nℹ Collection "branch_access" does not exist');
      } else {
        throw err;
      }
    }

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to drop branch_access collection!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan penghapusan collection
dropBranchAccessCollection().catch(console.error); 