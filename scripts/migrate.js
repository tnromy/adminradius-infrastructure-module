const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function runMigration(file) {
  try {
    console.log(`\nRunning migration: ${file}`);
    await execPromise(`node ${path.join(MIGRATIONS_DIR, file)}`);
    return true;
  } catch (error) {
    console.error(`Failed to run migration ${file}:`, error);
    return false;
  }
}

async function migrate() {
  try {
    const direction = process.argv[2];
    if (!direction || !['up', 'down'].includes(direction)) {
      console.error('Please specify migration direction: up or down');
      process.exit(1);
    }

    // Baca semua file di direktori migrations
    const files = await fs.readdir(MIGRATIONS_DIR);
    
    // Filter file berdasarkan arah migrasi
    let migrationFiles = files
      .filter(f => f.endsWith(`.${direction}.js`))
      .sort();

    // Untuk down migration, jalankan dalam urutan terbalik
    if (direction === 'down') {
      migrationFiles = migrationFiles.reverse();
    }

    if (migrationFiles.length === 0) {
      console.log('\nNo migrations found.');
      process.exit(0);
    }

    console.log(`\nFound ${migrationFiles.length} migrations to run`);
    
    // Jalankan migrasi satu per satu
    for (const file of migrationFiles) {
      const success = await runMigration(file);
      if (!success) {
        console.error('\nMigration failed. Stopping...');
        process.exit(1);
      }
    }

    console.log('\n✅ All migrations completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate(); 