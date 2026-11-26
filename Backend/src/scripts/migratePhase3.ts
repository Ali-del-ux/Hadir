import * as dotenv from 'dotenv';
dotenv.config();

import { pool } from '../config/database';

async function migrate() {
  console.log('🚀 Running Phase 3 Database Migration...');
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        family_id VARCHAR(100) NULL,
        is_revoked BOOLEAN DEFAULT FALSE,
        expires_at DATETIME NOT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_refresh_user (user_id),
        INDEX idx_refresh_token (token_hash),
        INDEX idx_refresh_family (family_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure family_id and is_revoked exist if table was created earlier without them
    const [cols]: any = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'refresh_tokens'`
    );
    const colNames = cols.map((c: any) => c.COLUMN_NAME);
    if (!colNames.includes('family_id')) {
      await pool.execute(`ALTER TABLE refresh_tokens ADD COLUMN family_id VARCHAR(100) NULL AFTER token_hash`);
    }
    if (!colNames.includes('is_revoked')) {
      await pool.execute(`ALTER TABLE refresh_tokens ADD COLUMN is_revoked BOOLEAN DEFAULT FALSE AFTER family_id`);
    }

    console.log('✅ Created/verified refresh_tokens table successfully.');
  } catch (error) {
    console.error('❌ Migration Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

migrate();
