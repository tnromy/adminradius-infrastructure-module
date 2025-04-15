const { connectDB } = require('../connections/mongodb_conn');

console.log('Creating net_devices collection...');

const createNetDevicesCollection = async () => {
  try {
    const connection = await connectDB();
    const db = connection.connection.useDb('adminradius');

    // Buat collection net_devices
    try {
      await db.createCollection('net_devices');
      console.log('\n✓ Collection "net_devices" created successfully');
    } catch (err) {
      if (err.code === 48) {
        console.log('\nℹ Collection "net_devices" already exists');
      } else {
        throw err;
      }
    }

    // Tutup koneksi
    await connection.connection.close();
    console.log('\nDatabase connection closed.');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Failed to create net_devices collection!');
    console.error('Error details:', error);
    process.exit(1);
  }
};

// Jalankan pembuatan collection
createNetDevicesCollection().catch(console.error); 