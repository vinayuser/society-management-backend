-- Enhanced Members Module
CREATE TABLE IF NOT EXISTS members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  flat_id INT UNSIGNED DEFAULT NULL,
  user_id INT UNSIGNED DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  profile_image VARCHAR(512) DEFAULT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'family_member',
  gender VARCHAR(16) DEFAULT NULL,
  dob DATE DEFAULT NULL,
  occupation VARCHAR(255) DEFAULT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  joined_at DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_id (society_id),
  INDEX idx_flat_id (flat_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_role (role),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS member_family (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(64) DEFAULT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  age INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_society_member (society_id, member_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS member_emergency_contacts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  relationship VARCHAR(64) DEFAULT NULL,
  phone VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_society_member (society_id, member_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS member_documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(64) DEFAULT NULL,
  file_url VARCHAR(512) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_society_member (society_id, member_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS member_vehicles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  member_id INT UNSIGNED NOT NULL,
  vehicle_number VARCHAR(64) NOT NULL,
  vehicle_type VARCHAR(32) NOT NULL DEFAULT 'car',
  parking_slot VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_society_member (society_id, member_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);
