const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'eduflow_db',
  });

  console.log('Connected to MySQL. Running consolidated Phase 1 migration...');

  async function addColumnIfNotExists(table, column, def) {
    const [rows] = await connection.query(
      `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (rows[0].cnt === 0) {
      await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
      console.log(`+ Added column ${column} to ${table}`);
    } else {
      console.log(`= Column ${column} already exists in ${table}`);
    }
  }

  async function addIndexIfNotExists(table, indexName, columns) {
    const [rows] = await connection.query(
      `SELECT COUNT(*) as cnt FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, indexName]
    );
    if (rows[0].cnt === 0) {
      await connection.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columns})`);
      console.log(`+ Added index ${indexName} on ${table}`);
    }
  }

  async function dropIndexIfExists(table, indexName) {
    const [rows] = await connection.query(
      `SELECT COUNT(*) as cnt FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, indexName]
    );
    if (rows[0].cnt > 0) {
      // Ensure a non-unique index on course_id exists before dropping unique key referenced by FK
      await addIndexIfNotExists(table, 'idx_grade_items_course', 'course_id');
      await connection.query(`ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``);
      console.log(`- Dropped index ${indexName} from ${table}`);
    }
  }

  // 1. courses columns
  await addColumnIfNotExists('courses', 'credit_hours', 'INT NOT NULL DEFAULT 3');
  await addColumnIfNotExists('courses', 'semester', 'VARCHAR(20) DEFAULT NULL');
  await addColumnIfNotExists('courses', 'capacity', 'INT DEFAULT 50');
  await addColumnIfNotExists('courses', 'schedule_day', "VARCHAR(100) NULL DEFAULT 'الأحد - الثلاثاء'");
  await addColumnIfNotExists('courses', 'schedule_time', "VARCHAR(100) NULL DEFAULT '09:00 ص - 10:30 ص'");
  await addColumnIfNotExists('courses', 'room', "VARCHAR(100) NULL DEFAULT 'قاعة 101'");

  // 2. course_grade_items table (no unique constraint on (course_id, category))
  await connection.query(`
    CREATE TABLE IF NOT EXISTS course_grade_items (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      course_id   VARCHAR(50)  NOT NULL,
      name        VARCHAR(100) NOT NULL,
      category    ENUM('attendance','assignments','midterm','final','other') NOT NULL,
      weight      DECIMAL(5,2) NOT NULL,
      max_score   DECIMAL(7,2) NOT NULL DEFAULT 100.00,
      created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      INDEX idx_grade_items_course (course_id)
    )
  `);
  await dropIndexIfExists('course_grade_items', 'uq_grade_item');
  console.log('+ Table course_grade_items ready');

  // 3. student_grades table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS student_grades (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      course_id       VARCHAR(50) NOT NULL,
      student_id      VARCHAR(50) NOT NULL,
      grade_item_id   INT NOT NULL,
      score           DECIMAL(7,2) DEFAULT NULL,
      version         INT NOT NULL DEFAULT 1,
      graded_by       VARCHAR(50) DEFAULT NULL,
      graded_at       TIMESTAMP   NULL,
      created_at      TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id)     REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id)    REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (grade_item_id) REFERENCES course_grade_items(id) ON DELETE CASCADE,
      FOREIGN KEY (graded_by)     REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE KEY uq_student_grade (student_id, grade_item_id)
    )
  `);
  console.log('+ Table student_grades ready');

  // 4. enrollments columns
  await addColumnIfNotExists('enrollments', 'total_score', 'DECIMAL(5,2) DEFAULT NULL');
  await addColumnIfNotExists('enrollments', 'letter_grade', 'VARCHAR(10) DEFAULT NULL');
  await addColumnIfNotExists('enrollments', 'grade_points', 'DECIMAL(3,2) DEFAULT NULL');
  await addColumnIfNotExists('enrollments', 'final_grade', 'VARCHAR(10) NULL');
  await addColumnIfNotExists('enrollments', 'attendance_override', 'INT NULL');

  // 5. users & admin_accounts columns
  await addColumnIfNotExists('users', 'academic_year', 'VARCHAR(50) NULL');
  await addColumnIfNotExists('users', 'token_version', 'INT NOT NULL DEFAULT 1');
  await addColumnIfNotExists('users', 'is_frozen', 'BOOLEAN DEFAULT FALSE');
  await addColumnIfNotExists('users', 'freeze_reason', 'TEXT NULL');
  await addColumnIfNotExists('users', 'two_factor_enabled', 'BOOLEAN DEFAULT FALSE');
  await addColumnIfNotExists('users', 'two_factor_secret', 'VARCHAR(255) NULL');
  await addColumnIfNotExists('users', 'account_locked_until', 'DATETIME NULL');
  await addColumnIfNotExists('admin_accounts', 'token_version', 'INT NOT NULL DEFAULT 1');

  // 6. assignments & assignment_submissions columns
  await addColumnIfNotExists('assignments', 'file_url', 'VARCHAR(500) NULL');
  await addColumnIfNotExists('assignments', 'file_name', 'VARCHAR(255) NULL');
  await addColumnIfNotExists('assignment_submissions', 'version', 'INT NOT NULL DEFAULT 1');

  // 7. attendance_sessions & attendance_records columns
  await addColumnIfNotExists('attendance_sessions', 'room', 'VARCHAR(100) NULL');
  await addColumnIfNotExists('attendance_sessions', 'qr_secret', 'VARCHAR(64) DEFAULT NULL');
  await addColumnIfNotExists('attendance_records', 'device_fingerprint', 'VARCHAR(128) NULL');
  await addIndexIfNotExists('attendance_records', 'idx_attendance_session_device', 'session_id, device_fingerprint');

  console.log('✅ Phase 1 Migration successfully completed!');
  await connection.end();
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
