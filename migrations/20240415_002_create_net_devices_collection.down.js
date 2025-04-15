const { connectDB } = require('../connections/mongodb_conn');

console.log('Dropping net_devices collection...');

const dropNetDevicesCollection = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');

    // Drop collection net_devices
    try {
      await db.collection('net_devices').drop();
      console.log('\n✓ Collection "net_devices" dropped successfully');
    } catch (err) {
      if (err.code === 26) {
        console.log('\nℹ Collection "net_devices" does not exist');
      } else {
        throw err;
      }
    }

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to drop net_devices collection!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan penghapusan collection
dropNetDevicesCollection().catch(console.error); 