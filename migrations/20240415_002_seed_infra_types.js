const { connectDB } = require('../conn');
const { uuidv7 } = require('uuidv7');

const infraTypes = [
  {
    _id: uuidv7(),
    name: "router",
    display_name: "Router",
  },
  {
    _id: uuidv7(),
    name: "olt",
    display_name: "OLT",
  },
  {
    _id: uuidv7(),
    name: "odc",
    display_name: "ODC",
  },
  {
    _id: uuidv7(),
    name: "odp",
    display_name: "ODP",
  },
  {
    _id: uuidv7(),
    name: "ont",
    display_name: "ONT",
  }
];

const seedInfraTypes = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');
    const collection = db.collection('infra_types');

    console.log('\nSeeding infra_types collection:');
    console.log('-----------------------------');

    // Hapus data yang ada sebelumnya (opsional)
    await collection.deleteMany({});
    console.log('✓ Existing data cleared');

    // Insert data baru
    const result = await collection.insertMany(infraTypes);
    console.log(`✓ ${result.insertedCount} infra types inserted`);

    // Tampilkan data yang telah di-insert
    console.log('\nInserted Data:');
    console.log('--------------');
    const insertedData = await collection.find({}).toArray();
    insertedData.forEach(doc => {
      console.log(`• ${doc.display_name} (${doc.name})`);
      console.log(`  ID: ${doc._id}`);
    });

    console.log('\n✅ Seeding completed successfully!');

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Seeding failed!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan seeder
seedInfraTypes().catch(console.error); 