-- Run this on an existing database to add chat tables without re-running full schema.
-- Usage: mysql -u user -p society_management < src/database/chat-migration.sql

CREATE TABLE IF NOT EXISTS chat_groups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  icon VARCHAR(128) DEFAULT NULL,
  admin_only_posting TINYINT(1) NOT NULL DEFAULT 0,
  members_can_delete_own TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS chat_group_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_group_user (group_id, user_id),
  INDEX idx_group_id (group_id),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id INT UNSIGNED NOT NULL,
  society_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  message_text TEXT NOT NULL,
  message_type ENUM('text', 'image', 'file', 'emoji') NOT NULL DEFAULT 'text',
  media_url VARCHAR(512) DEFAULT NULL,
  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_group_id (group_id),
  INDEX idx_society_id (society_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_message_reads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  message_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_message_user (message_id, user_id),
  INDEX idx_message_id (message_id),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
