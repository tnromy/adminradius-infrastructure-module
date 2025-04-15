const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const SEEDERS_DIR = path.join(__dirname, '..', 'seeders');

async function runSeeder(file) {
  try {
    console.log(`\nRunning seeder: ${file}`);
    await execPromise(`node ${path.join(SEEDERS_DIR, file)}`);
    return true;
  } catch (error) {
    console.error(`Failed to run seeder ${file}:`, error);
    return false;
  }
}

async function seed() {
  try {
    // Baca semua file di direktori seeders
    const files = await fs.readdir(SEEDERS_DIR);
    
    // Filter hanya file JavaScript
    const seederFiles = files.filter(f => f.endsWith('.js')).sort();

    if (seederFiles.length === 0) {
      console.log('\nNo seeders found.');
      process.exit(0);
    }

    console.log(`\nFound ${seederFiles.length} seeders to run`);
    
    // Jalankan seeder satu per satu
    for (const file of seederFiles) {
      const success = await runSeeder(file);
      if (!success) {
        console.error('\nSeeding failed. Stopping...');
        process.exit(1);
      }
    }

    console.log('\n✅ All seeders completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed(); 