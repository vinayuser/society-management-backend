-- Enhanced Guard Management Module
-- Run with: node src/database/guard-migrate.js (after schema.sql / migrate.js)

-- 2) guard_shifts
CREATE TABLE IF NOT EXISTS guard_shifts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guard_id INT UNSIGNED NOT NULL,
  society_id INT UNSIGNED NOT NULL,
  shift_start DATETIME NOT NULL,
  shift_end DATETIME NOT NULL,
  assigned_gate VARCHAR(128) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_guard_id (guard_id),
  INDEX idx_society_id (society_id),
  INDEX idx_shift_start (shift_start),
  FOREIGN KEY (guard_id) REFERENCES guards(id) ON DELETE CASCADE,
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
);

-- 3) guard_leaves
CREATE TABLE IF NOT EXISTS guard_leaves (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guard_id INT UNSIGNED NOT NULL,
  society_id INT UNSIGNED NOT NULL,
  leave_type VARCHAR(32) NOT NULL DEFAULT 'casual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_guard_id (guard_id),
  INDEX idx_society_id (society_id),
  INDEX idx_status (status),
  INDEX idx_dates (start_date, end_date),
  FOREIGN KEY (guard_id) REFERENCES guards(id) ON DELETE CASCADE,
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
);

-- 4) guard_documents
CREATE TABLE IF NOT EXISTS guard_documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guard_id INT UNSIGNED NOT NULL,
  society_id INT UNSIGNED NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(64) DEFAULT NULL,
  file_url VARCHAR(512) NOT NULL,
  expiry_date DATE DEFAULT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_guard_id (guard_id),
  INDEX idx_society_id (society_id),
  FOREIGN KEY (guard_id) REFERENCES guards(id) ON DELETE CASCADE,
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
);
