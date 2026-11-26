import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function setupTestDB() {
  console.log('Starting Test DB Setup...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    multipleStatements: true
  });

  const dbName = 'eduflow_security_test';

  console.log(`Dropping and recreating ${dbName}...`);
  await connection.query(`DROP DATABASE IF EXISTS ${dbName};`);
  await connection.query(`CREATE DATABASE ${dbName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  await connection.query(`USE ${dbName};`);

  console.log('Applying consolidated init_schema.sql...');
  const initSqlPath = path.join(__dirname, '../src/scripts/init_schema.sql');
  let initSql = fs.readFileSync(initSqlPath, 'utf8');
  initSql = initSql.replace(/eduflow_db/g, dbName);

  await connection.query(initSql);

  console.log('✅ Test database set up successfully.');
  await connection.end();
}

setupTestDB().catch((err) => {
  console.error('❌ Failed to set up test DB:', err);
  process.exit(1);
});
