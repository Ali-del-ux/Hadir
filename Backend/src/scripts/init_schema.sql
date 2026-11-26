-- ============================================================
--  EduFlow / Hadir DB Schema – Consolidated v2.2
--  Run this file ONCE to create/reset the full database.
-- ============================================================

DROP DATABASE IF EXISTS eduflow_db;
CREATE DATABASE eduflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE eduflow_db;

-- ─────────────────────────────────────────────────────────────
--  users  (students + teachers)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE users (
  id                   VARCHAR(50)  PRIMARY KEY,
  name                 VARCHAR(255) NOT NULL,
  email                VARCHAR(255) NOT NULL UNIQUE,
  password_hash        VARCHAR(255) NOT NULL,
  role                 ENUM('teacher','student') NOT NULL,
  student_id           VARCHAR(50)  UNIQUE,
  teacher_code         VARCHAR(20)  UNIQUE,
  department           VARCHAR(150),
  academic_year        VARCHAR(50)  NULL,
  avatar               VARCHAR(255),
  is_active            BOOLEAN      DEFAULT TRUE,
  is_frozen            BOOLEAN      DEFAULT FALSE,
  freeze_reason        TEXT         NULL,
  two_factor_enabled   BOOLEAN      DEFAULT FALSE,
  two_factor_secret    VARCHAR(255) NULL,
  token_version        INT          NOT NULL DEFAULT 1,
  account_locked_until DATETIME     NULL,
  created_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at           TIMESTAMP    NULL
);

CREATE INDEX idx_users_email      ON users(email);
CREATE INDEX idx_users_student_id ON users(student_id);
CREATE INDEX idx_users_role       ON users(role);

-- ─────────────────────────────────────────────────────────────
--  admin_accounts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE admin_accounts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active     BOOLEAN      DEFAULT TRUE,
  token_version INT          NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
--  courses
-- ─────────────────────────────────────────────────────────────
CREATE TABLE courses (
  id            VARCHAR(50)  PRIMARY KEY,
  code          VARCHAR(30)  NOT NULL UNIQUE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  teacher_id    VARCHAR(50),
  credit_hours  INT          NOT NULL DEFAULT 3,
  semester      VARCHAR(20)  DEFAULT NULL,
  capacity      INT          DEFAULT 50,
  schedule_day  VARCHAR(100) NULL DEFAULT 'الأحد - الثلاثاء',
  schedule_time VARCHAR(100) NULL DEFAULT '09:00 ص - 10:30 ص',
  room          VARCHAR(100) NULL DEFAULT 'قاعة 101',
  created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    TIMESTAMP    NULL,
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

CREATE INDEX idx_courses_teacher ON courses(teacher_id);

-- ─────────────────────────────────────────────────────────────
--  enrollments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE enrollments (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  course_id           VARCHAR(50)  NOT NULL,
  student_id          VARCHAR(50)  NOT NULL,
  status              ENUM('active','dropped') DEFAULT 'active',
  enrolled_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  total_score         DECIMAL(5,2) DEFAULT NULL,
  letter_grade        VARCHAR(10)  DEFAULT NULL,
  grade_points        DECIMAL(3,2) DEFAULT NULL,
  final_grade         VARCHAR(10)  NULL,
  attendance_override INT          NULL,
  FOREIGN KEY (course_id)  REFERENCES courses(id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  UNIQUE KEY uq_enrollment (course_id, student_id)
);

-- ─────────────────────────────────────────────────────────────
--  lectures
-- ─────────────────────────────────────────────────────────────
CREATE TABLE lectures (
  id          VARCHAR(50)  PRIMARY KEY,
  course_id   VARCHAR(50)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  date        DATE         NOT NULL,
  file_url    VARCHAR(500),
  file_name   VARCHAR(255),
  file_size   VARCHAR(50),
  file_type   VARCHAR(50),
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  TIMESTAMP    NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- ─────────────────────────────────────────────────────────────
--  assignments
-- ─────────────────────────────────────────────────────────────
CREATE TABLE assignments (
  id          VARCHAR(50)  PRIMARY KEY,
  course_id   VARCHAR(50)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  due_date    TIMESTAMP    NOT NULL,
  file_url    VARCHAR(500),
  file_name   VARCHAR(255),
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at  TIMESTAMP    NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- ─────────────────────────────────────────────────────────────
--  assignment_submissions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE assignment_submissions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id VARCHAR(50)  NOT NULL,
  student_id    VARCHAR(50)  NOT NULL,
  file_url      VARCHAR(500),
  file_name     VARCHAR(255),
  status        ENUM('pending','submitted','graded') DEFAULT 'submitted',
  grade         VARCHAR(10),
  percentage    DECIMAL(5,2),
  feedback      TEXT,
  version       INT          NOT NULL DEFAULT 1,
  submitted_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  graded_at     TIMESTAMP    NULL,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id),
  FOREIGN KEY (student_id)    REFERENCES users(id),
  UNIQUE KEY uq_submission (assignment_id, student_id)
);

-- ─────────────────────────────────────────────────────────────
--  attendance_sessions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE attendance_sessions (
  id          VARCHAR(50)  PRIMARY KEY,
  course_id   VARCHAR(50)  NOT NULL,
  date        DATE         NOT NULL,
  time        TIME         NOT NULL,
  room        VARCHAR(100) NULL,
  qr_code     VARCHAR(30)  NOT NULL UNIQUE,
  qr_secret   VARCHAR(64)  DEFAULT NULL,
  status      ENUM('active','closed') DEFAULT 'active',
  created_by  VARCHAR(50),
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  closed_at   TIMESTAMP    NULL,
  FOREIGN KEY (course_id)  REFERENCES courses(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_sessions_course  ON attendance_sessions(course_id);
CREATE INDEX idx_sessions_qr_code ON attendance_sessions(qr_code);

-- ─────────────────────────────────────────────────────────────
--  attendance_records
-- ─────────────────────────────────────────────────────────────
CREATE TABLE attendance_records (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  session_id         VARCHAR(50)  NOT NULL,
  student_id         VARCHAR(50)  NOT NULL,
  attendance_time    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  method             ENUM('qr','manual') DEFAULT 'qr',
  device_fingerprint VARCHAR(128) NULL,
  FOREIGN KEY (session_id) REFERENCES attendance_sessions(id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  UNIQUE KEY uq_attendance (session_id, student_id),
  INDEX idx_attendance_session_device (session_id, device_fingerprint)
);

-- ─────────────────────────────────────────────────────────────
--  course_grade_items (supports multiple items per category)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE course_grade_items (
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

-- ─────────────────────────────────────────────────────────────
--  student_grades
-- ─────────────────────────────────────────────────────────────
CREATE TABLE student_grades (
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

-- ─────────────────────────────────────────────────────────────
--  refresh_tokens
-- ─────────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(50)  NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  family_id  VARCHAR(100) NULL,
  is_revoked BOOLEAN      DEFAULT FALSE,
  expires_at DATETIME     NOT NULL,
  ip_address VARCHAR(45)  NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_refresh_user   (user_id),
  INDEX idx_refresh_token  (token_hash),
  INDEX idx_refresh_family (family_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
--  student_financials
-- ─────────────────────────────────────────────────────────────
CREATE TABLE student_financials (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  student_id        VARCHAR(50)  NOT NULL UNIQUE,
  student_name      VARCHAR(255) NOT NULL,
  student_number    VARCHAR(50)  NULL,
  total_tuition     DECIMAL(10,2) DEFAULT 3500.00,
  paid_amount       DECIMAL(10,2) DEFAULT 0.00,
  discount          DECIMAL(10,2) DEFAULT 0.00,
  status            ENUM('paid', 'partial', 'unpaid') DEFAULT 'unpaid',
  is_frozen         BOOLEAN DEFAULT FALSE,
  freeze_reason     VARCHAR(255) NULL,
  last_payment_date DATETIME NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_financial_student (student_id),
  INDEX idx_financial_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
--  financial_transactions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE financial_transactions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  student_id       VARCHAR(50)  NOT NULL,
  amount           DECIMAL(10,2) NOT NULL,
  transaction_type ENUM('payment','discount','fee','refund') NOT NULL DEFAULT 'payment',
  receipt_number   VARCHAR(100) NOT NULL,
  payment_method   VARCHAR(50)  DEFAULT 'نقدي',
  notes            TEXT         NULL,
  created_by       VARCHAR(50)  NULL,
  created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_trans_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────
--  login_audit_logs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE login_audit_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  status     ENUM('success', 'failed_password', 'failed_2fa', 'blocked') NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
