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

const TARGET_CHARSET = 'utf8mb4';
const TARGET_COLLATION = 'utf8mb4_unicode_ci';

function escapeIdentifier(identifier: string): string {
  return `\`${identifier.replace(/`/g, '``')}\``;
}

/**
 * Ensures database and all tables/columns share utf8mb4_unicode_ci collation
 * so joins never fail with ER_CANT_AGGREGATE_2COLLATIONS on hosts whose
 * default schema collation is utf8mb4_0900_ai_ci (e.g. Railway MySQL 8).
 */
async function normalizeDatabaseCollations(conn: mysql.Connection): Promise<void> {
  try {
    await conn.query(
      `ALTER DATABASE ${escapeIdentifier(env.DB_NAME)} CHARACTER SET ${TARGET_CHARSET} COLLATE ${TARGET_COLLATION}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[DB] Skipping ALTER DATABASE collation: ${message}`);
  }

  const [mismatchedTables] = await conn.query<any[]>(
    `SELECT DISTINCT TABLE_NAME AS tableName
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_TYPE = 'BASE TABLE'
       AND (
         TABLE_COLLATION <> ?
         OR TABLE_NAME IN (
           SELECT TABLE_NAME
           FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND COLLATION_NAME IS NOT NULL
             AND COLLATION_NAME <> ?
         )
       )`,
    [TARGET_COLLATION, TARGET_COLLATION]
  );

  if (!Array.isArray(mismatchedTables) || mismatchedTables.length === 0) {
    return;
  }

  console.log(`[DB] Normalizing collation to ${TARGET_COLLATION} for ${mismatchedTables.length} table(s)...`);
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const row of mismatchedTables) {
      const tableName = String(row.tableName);
      await conn.query(
        `ALTER TABLE ${escapeIdentifier(tableName)} CONVERT TO CHARACTER SET ${TARGET_CHARSET} COLLATE ${TARGET_COLLATION}`
      );
    }
  } finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  }
  console.log('[DB] Table collations normalized successfully.');
}

/**
 * Removes temporary smoke-test rows (if any) and ensures students with
 * pre-paid tuition balances have an initial official receipt row.
 */
async function syncFinancialLedgerReceipts(conn: mysql.Connection): Promise<void> {
  await conn.query(`DELETE FROM financial_transactions WHERE student_id LIKE 'TESTFIN%'`);
  await conn.query(`DELETE FROM student_financials WHERE student_id LIKE 'TESTFIN%'`);
  await conn.query(`DELETE FROM users WHERE id LIKE 'TESTFIN%'`);

  await conn.query(`
    INSERT INTO financial_transactions (student_id, amount, receipt_number, payment_method, notes, created_by)
    SELECT
      sf.student_id,
      sf.paid_amount,
      CONCAT('REC-INIT-', sf.student_id),
      'نقدي (خزينة الكلية)',
      'سداد مبدئي مسجل عند تهيئة النظام',
      'admin_1'
    FROM student_financials sf
    JOIN users u ON sf.student_id = u.id
    WHERE u.deleted_at IS NULL
      AND sf.paid_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM financial_transactions ft WHERE ft.student_id = sf.student_id
      )
  `);

  await conn.query(`
    UPDATE student_financials
    SET last_payment_date = COALESCE(last_payment_date, NOW())
    WHERE paid_amount > 0 AND last_payment_date IS NULL
  `);
}

/**
 * Ensures database schema, uniform collations, and initial seed records exist.
 * Safe no-op when already initialized and aligned.
 */
export async function ensureDatabaseInitialized(): Promise<void> {
  let needsSeed = false;
  const conn = await connectWithRetry();
  try {
    const [tables] = await conn.query<any[]>("SHOW TABLES LIKE 'users'");
    if (!Array.isArray(tables) || tables.length === 0) {
      console.log('[DB] Empty database detected — applying schema (init_schema.sql)...');
      const schemaSql = loadTargetSchemaSql();
      await conn.query(schemaSql);
      console.log('[DB] Schema applied successfully.');
      needsSeed = true;
    } else {
      console.log('[DB] Schema already initialized.');
    }

    await normalizeDatabaseCollations(conn);
    await syncFinancialLedgerReceipts(conn);
  } finally {
    await conn.end();
  }

  if (needsSeed) {
    console.log('[DB] Running initial seed...');
    await runSeed();
    console.log('[DB] Database bootstrap complete.');
  }
}
