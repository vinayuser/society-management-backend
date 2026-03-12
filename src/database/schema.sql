-- Society Management SaaS - Core Schema
-- Run: node src/database/migrate.js (after creating DB: CREATE DATABASE society_management)

CREATE TABLE IF NOT EXISTS societies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  alias VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  flat_count INT UNSIGNED NOT NULL DEFAULT 0,
  plan_type ENUM('shared_app', 'white_label') NOT NULL DEFAULT 'shared_app',
  setup_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  monthly_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('invited', 'onboarding_completed', 'active', 'suspended') NOT NULL DEFAULT 'invited',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_alias (alias),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS society_invites (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  flat_count INT UNSIGNED NOT NULL DEFAULT 0,
  plan_type ENUM('shared_app', 'white_label') NOT NULL DEFAULT 'shared_app',
  setup_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  monthly_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  invite_token VARCHAR(64) NOT NULL UNIQUE,
  status ENUM('pending', 'accepted', 'expired') NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_invite_token (invite_token),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS society_config (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL UNIQUE,
  logo VARCHAR(512) DEFAULT NULL,
  theme_color VARCHAR(32) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  banner_image VARCHAR(512) DEFAULT NULL,
  towers_blocks JSON DEFAULT NULL,
  total_flats INT UNSIGNED DEFAULT NULL,
  admin_contact_name VARCHAR(255) DEFAULT NULL,
  admin_contact_phone VARCHAR(32) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  INDEX idx_society_id (society_id)
);

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  password_hash VARCHAR(255) DEFAULT NULL,
  role ENUM('super_admin', 'society_admin', 'resident', 'security_guard') NOT NULL,
  email_verified TINYINT(1) DEFAULT 0,
  phone_verified TINYINT(1) DEFAULT 0,
  fcm_token VARCHAR(512) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_email_society (email, society_id),
  INDEX idx_society_id (society_id),
  INDEX idx_role (role),
  INDEX idx_email (email),
  INDEX idx_phone (phone),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS flats (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  tower VARCHAR(64) NOT NULL,
  flat_number VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_society_tower_flat (society_id, tower, flat_number),
  INDEX idx_society_id (society_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS residents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  flat_id INT UNSIGNED NOT NULL,
  is_primary TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_flat (user_id, flat_id),
  INDEX idx_society_id (society_id),
  INDEX idx_flat_id (flat_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guards (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS visitors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  flat_id INT UNSIGNED NOT NULL,
  visitor_name VARCHAR(255) NOT NULL,
  visitor_phone VARCHAR(32) DEFAULT NULL,
  purpose VARCHAR(255) DEFAULT NULL,
  entry_time TIMESTAMP NOT NULL,
  exit_time TIMESTAMP NULL DEFAULT NULL,
  approved_by_user_id INT UNSIGNED DEFAULT NULL,
  logged_by_user_id INT UNSIGNED DEFAULT NULL,
  visitor_type ENUM('guest', 'delivery', 'vendor') DEFAULT 'guest',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  INDEX idx_flat_id (flat_id),
  INDEX idx_entry_time (entry_time),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (logged_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS complaints (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(64) DEFAULT NULL,
  status ENUM('open', 'in_progress', 'resolved') NOT NULL DEFAULT 'open',
  assigned_staff_id INT UNSIGNED DEFAULT NULL,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notices (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMP NULL DEFAULT NULL,
  published_at TIMESTAMP NULL DEFAULT NULL,
  created_by INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  INDEX idx_scheduled_at (scheduled_at),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS billing (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type ENUM('setup', 'monthly') NOT NULL,
  billing_date DATE NOT NULL,
  due_date DATE DEFAULT NULL,
  payment_status ENUM('pending', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP NULL DEFAULT NULL,
  invoice_number VARCHAR(64) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  INDEX idx_billing_date (billing_date),
  INDEX idx_payment_status (payment_status),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  type ENUM('banner', 'video', 'promotion') NOT NULL DEFAULT 'banner',
  content_url VARCHAR(512) NOT NULL,
  title VARCHAR(255) DEFAULT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  INDEX idx_dates (start_date, end_date),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_verification (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  phone_or_email VARCHAR(255) NOT NULL,
  otp VARCHAR(8) NOT NULL,
  purpose ENUM('login', 'verify_phone', 'verify_email') NOT NULL DEFAULT 'login',
  expires_at TIMESTAMP NOT NULL,
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone_email (phone_or_email),
  INDEX idx_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(512) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token(255)),
  INDEX idx_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Module: Vendor Marketplace
CREATE TABLE IF NOT EXISTS vendors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  vendor_name VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  service_area VARCHAR(255) DEFAULT NULL,
  rating DECIMAL(3,2) DEFAULT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  INDEX idx_category (category),
  INDEX idx_status (status),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
);

-- Module: Delivery and Package Tracking
CREATE TABLE IF NOT EXISTS deliveries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  flat_id INT UNSIGNED NOT NULL,
  delivery_type VARCHAR(64) NOT NULL DEFAULT 'courier',
  package_photo VARCHAR(512) DEFAULT NULL,
  received_by_guard INT UNSIGNED DEFAULT NULL,
  status ENUM('received', 'notified', 'collected') NOT NULL DEFAULT 'received',
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  collected_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  INDEX idx_flat_id (flat_id),
  INDEX idx_received_at (received_at),
  INDEX idx_status (status),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE CASCADE,
  FOREIGN KEY (received_by_guard) REFERENCES users(id) ON DELETE SET NULL
);

-- Module: Community Marketplace
CREATE TABLE IF NOT EXISTS marketplace_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  price DECIMAL(12,2) DEFAULT NULL,
  image_url VARCHAR(512) DEFAULT NULL,
  status ENUM('active', 'sold', 'removed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Module: Community Engagement - Lost and Found
CREATE TABLE IF NOT EXISTS lost_found (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  image_url VARCHAR(512) DEFAULT NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  INDEX idx_status (status),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Module: Community Engagement - Polls
CREATE TABLE IF NOT EXISTS polls (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  created_by INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS poll_options (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  poll_id INT UNSIGNED NOT NULL,
  option_label VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED DEFAULT 0,
  INDEX idx_poll_id (poll_id),
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  poll_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  option_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_poll_user (poll_id, user_id),
  INDEX idx_poll_id (poll_id),
  FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE
);

-- Module: Real-Time Chat (multi-tenant, society-scoped)
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
