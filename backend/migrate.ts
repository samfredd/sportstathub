import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrationsDir = join(__dirname, 'src', 'migrations');
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

try {
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    console.log(`✓ ${file}`);
  }
  console.log('All migrations complete');
} finally {
  await pool.end();
}
