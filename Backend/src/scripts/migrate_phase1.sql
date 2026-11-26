-- Consolidated Phase 1 Reference SQL (MySQL 8/9 compatible via init_schema.sql or migrate.js)
-- Use `node src/scripts/migrate.js` for idempotent upgrades on existing databases.
USE eduflow_db;

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
);

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
);
