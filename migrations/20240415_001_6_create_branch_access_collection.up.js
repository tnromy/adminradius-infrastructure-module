const { connectDB } = require('../connections/mongodb_conn');

console.log('Creating branch_access collection...');

const createBranchAccessCollection = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');

    // Buat collection branch_access
    try {
      await db.createCollection('branch_access', {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["branch_id", "user_id", "permission"],
            properties: {
              branch_id: {
                bsonType: "objectId",
                description: "ID dari branch yang diakses"
              },
              user_id: {
                bsonType: "string",
                description: "UUID dari user yang memiliki akses"
              },
              permission: {
                enum: ["R", "RW"],
                description: "Tipe akses: R (read) atau RW (read-write)"
              }
            }
          }
        }
      });
      console.log('\n✓ Collection "branch_access" created successfully');

      // Buat index untuk optimasi query
      const collection = db.collection('branch_access');
      await collection.createIndex({ user_id: 1 });
      await collection.createIndex({ branch_id: 1, user_id: 1 }, { unique: true });
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