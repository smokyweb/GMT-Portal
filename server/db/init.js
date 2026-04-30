import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function init() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  try {
    await pool.query(sql);
    console.log('Database schema created successfully.');
  } catch (err) {
    console.error('Schema init failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

init();
