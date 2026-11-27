-- ============================================================================
-- ระบบบริหารจัดการชั่วโมงจิตอาสาสำหรับนักศึกษาทุน (DIT204 / DIT205)
-- สำหรับรันใน TiDB Cloud (SQL Editor) หรือ MySQL
-- ============================================================================

-- 1. สร้างฐานข้อมูลและเลือกใช้งาน
CREATE DATABASE IF NOT EXISTS `dit205_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `dit205_db`;

-- ============================================================================
-- 2. ตารางผู้ใช้งานระบบ (volunteer_users) - เชื่อมต่อตรงกับ Next.js API (src/lib/tidb.ts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `volunteer_users` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(255) NULL,
  `last_name` VARCHAR(255) NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'student',
  `student_id` VARCHAR(50) NULL,
  `scholarship_type_id` VARCHAR(64) NULL,
  `scholarship_type_ids` TEXT NULL,
  `faculty` VARCHAR(255) NULL,
  `major` VARCHAR(255) NULL,
  `phone` VARCHAR(50) NULL,
  `created_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `volunteer_uploads` (
  `id` VARCHAR(80) PRIMARY KEY,
  `mime_type` VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
  `file_name` VARCHAR(255) NULL,
  `data` LONGTEXT NOT NULL,
  `created_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `volunteer_app_state` (
  `state_key` VARCHAR(64) PRIMARY KEY,
  `payload` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 3. ตารางประเภททุนการศึกษา (scholarship_types) ตามเอกสาร DIT204Final_edit.docx
-- ============================================================================
CREATE TABLE IF NOT EXISTS `scholarship_types` (
  `id` VARCHAR(64) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `target_hours` INT NOT NULL DEFAULT 0,
  `is_loan` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = ทุน กยศ. (เลือกควบคู่ทุนอื่นได้), 0 = ทุนหลัก (เลือกได้อย่างใดอย่างหนึ่ง)',
  `academic_year` VARCHAR(20) NOT NULL DEFAULT '2569',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `scholarship_types` (`id`, `name`, `description`, `target_hours`, `is_loan`, `academic_year`) VALUES
  ('sch-1', 'ทุนเรียนดี 100%', 'ทุนการศึกษาผลการเรียนดีเด่นระดับร้อยละ 100% ตามเงื่อนไขของหน่วยงาน', 100, 0, '2569'),
  ('sch-2', 'ทุนเรียนดี 50%', 'ทุนการศึกษาผลการเรียนดีระดับร้อยละ 50% ตามเงื่อนไขของหน่วยงาน', 50, 0, '2569'),
  ('sch-3', 'ทุนเรียนดี 25%', 'ทุนการศึกษาผลการเรียนดีระดับร้อยละ 25% ตามเงื่อนไขของหน่วยงาน', 25, 0, '2569'),
  ('sch-4', 'ทุน กยศ. (กองทุนเงินให้กู้ยืมเพื่อการศึกษา)', 'ทุนกู้ยืมเพื่อการศึกษา กยศ. เงื่อนไขสะสมชั่วโมงจิตอาสา 18 ชั่วโมง (สามารถเลือกควบคู่กับทุนอื่นได้)', 18, 1, '2569')
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `target_hours` = VALUES(`target_hours`),
  `is_loan` = VALUES(`is_loan`);

-- ============================================================================
-- 4. ตารางกิจกรรมจิตอาสา (activities)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `activities` (
  `id` VARCHAR(64) PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `organizer_id` VARCHAR(64) NOT NULL,
  `organizer_name` VARCHAR(255) NOT NULL,
  `date` VARCHAR(50) NOT NULL,
  `start_time` VARCHAR(20) NOT NULL,
  `end_time` VARCHAR(20) NOT NULL,
  `location` VARCHAR(255) NOT NULL,
  `max_participants` INT NOT NULL DEFAULT 50,
  `hours_awarded` INT NOT NULL DEFAULT 3,
  `status` VARCHAR(50) NOT NULL DEFAULT 'open',
  `qr_code_secret` VARCHAR(100) NOT NULL,
  `category` VARCHAR(100) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 5. ตารางการลงทะเบียน (registrations), การเช็กชื่อ (attendances), และชั่วโมงสะสม (hour_records)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `registrations` (
  `id` VARCHAR(64) PRIMARY KEY,
  `activity_id` VARCHAR(64) NOT NULL,
  `student_id` VARCHAR(64) NOT NULL,
  `student_name` VARCHAR(255) NOT NULL,
  `student_code` VARCHAR(50) NOT NULL,
  `registered_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(50) NOT NULL DEFAULT 'registered'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `attendances` (
  `id` VARCHAR(64) PRIMARY KEY,
  `activity_id` VARCHAR(64) NOT NULL,
  `student_id` VARCHAR(64) NOT NULL,
  `check_in_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `qr_reference` VARCHAR(100) NOT NULL,
  `verified` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hour_records` (
  `id` VARCHAR(64) PRIMARY KEY,
  `student_id` VARCHAR(64) NOT NULL,
  `student_name` VARCHAR(255) NOT NULL,
  `student_code` VARCHAR(50) NOT NULL,
  `activity_id` VARCHAR(64) NOT NULL,
  `activity_title` VARCHAR(255) NOT NULL,
  `hours` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending_verification',
  `evidence_id` VARCHAR(64) NULL,
  `approved_by` VARCHAR(255) NULL,
  `approved_at` DATETIME NULL,
  `comment` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 6. ตารางตรวจสอบข้อมูลที่บันทึกแล้ว
-- ============================================================================
SELECT id, name, email, role, student_id, scholarship_type_ids, faculty FROM `volunteer_users`;
SELECT id, name, target_hours, is_loan FROM `scholarship_types`;
