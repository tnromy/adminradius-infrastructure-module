const { connectDB } = require('../connections/mongodb_conn');

console.log('Creating branch_access collection...');

const createBranchAccessCollection = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');

    // Buat collection branch_access
    try {
      await db.createCollection('branch_access');
      console.log('\n✓ Collection "branch_access" created successfully');

      // Buat indexes
      const collection = db.collection('branch_access');
      await collection.createIndex({ branch_id: 1, user_id: 1 }, { name: 'idx_branch_user' });
      await collection.createIndex({ created_at: -1 }, { name: 'idx_created_at' });
      await collection.createIndex({ status: 1 }, { name: 'idx_status' });
      console.log('\n✓ Indexes created successfully');
      
    } catch (err) {
      if (err.code === 48) {
        console.log('\nℹ Collection "branch_access" already exists');
      } else {
        throw err;
      }
    }

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to create branch_access collection!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan pembuatan collection
createBranchAccessCollection().catch(console.error); 