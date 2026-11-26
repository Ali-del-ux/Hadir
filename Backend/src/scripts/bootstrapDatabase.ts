import * as fs from 'fs';
import * as path from 'path';
import mysql from 'mysql2/promise';
import { env } from '../config/env';
import { runSeed } from './seedDatabase';

const MAX_RETRIES = 6;
const RETRY_DELAY_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function resolveSchemaPath(): string {
  const candidates = [
    path.resolve(__dirname, 'init_schema.sql'),
    path.resolve(__dirname, '../../src/scripts/init_schema.sql'),
  ];
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`init_schema.sql not found in: ${candidates.join(', ')}`);
  }
  return found;
}

/**
 * Strips database-level DROP/CREATE/USE statements so the schema executes
 * safely inside the configured target database (e.g., Railway's `railway` DB).
 */
function loadTargetSchemaSql(): string {
  const rawSql = fs.readFileSync(resolveSchemaPath(), 'utf8');
  return rawSql
    .replace(/^\s*DROP\s+DATABASE\s+IF\s+EXISTS\s+[^;]+;\s*$/gim, '')
    .replace(/^\s*CREATE\s+DATABASE\s+[^;]+;\s*$/gim, '')
    .replace(/^\s*USE\s+[^;]+;\s*$/gim, '');
}

async function connectWithRetry(): Promise<mysql.Connection> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await mysql.createConnection({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        multipleStatements: true,
      });
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[DB] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${message}`);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}

/**
 * Ensures database schema and initial demo/seed records exist on first boot.
 * Safe no-op when the `users` table is already present.
 */
export async function ensureDatabaseInitialized(): Promise<void> {
  const conn = await connectWithRetry();
  try {
    const [tables] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
    if (Array.isArray(tables) && tables.length > 0) {
      console.log('[DB] Schema already initialized.');
      return;
    }

    console.log('[DB] Empty database detected — applying schema (init_schema.sql)...');
    const schemaSql = loadTargetSchemaSql();
    await conn.query(schemaSql);
    console.log('[DB] Schema applied successfully.');
  } finally {
    await conn.end();
  }

  console.log('[DB] Running initial seed...');
  await runSeed();
  console.log('[DB] Database bootstrap complete.');
}
