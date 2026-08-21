import pg from 'pg';
import env from './env.js';
import { initSchema } from '../db/schema.js';

const { Pool } = pg;

let pool = null;
let schemaReady = false;

function registerTypeParsers() {
  pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
  pg.types.setTypeParser(23, (v) => (v === null ? null : Number(v)));
  pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
  pg.types.setTypeParser(1114, (v) => (v === null ? null : new Date(v)));
  pg.types.setTypeParser(1184, (v) => (v === null ? null : new Date(v)));
}

export async function connectDatabase() {
  if (pool) return pool;

  registerTypeParsers();
  pool = new Pool({
    connectionString: env.databaseUrl,
    max: 5,
    connectionTimeoutMillis: 20000,
    idleTimeoutMillis: 60000,
  });
  pool.on('error', (error) => {
    console.error('[DB] Pool client error (connection recycled):', error.message);
  });

  await pool.query('SELECT 1');
  if (!schemaReady) {
    await initSchema(pool);
    schemaReady = true;
  }
  return pool;
}

export async function query(text, params) {
  if (!pool) await connectDatabase();
  return pool.query(text, params);
}

export async function disconnectDatabase() {
  if (!pool) return;
  await pool.end();
  pool = null;
  schemaReady = false;
}

export function getDatabaseStatus() {
  return pool ? 'connected' : 'disconnected';
}