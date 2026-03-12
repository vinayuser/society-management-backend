-- Enhanced Flats Module: flat_members, flat_vehicles, flat_documents
-- flats table extended via flats-migrate.js (floor, flat_type, area_sqft, ownership_type, owner_name, owner_contact, owner_email, status)

CREATE TABLE IF NOT EXISTS flat_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  flat_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(32) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'family_member',
  profile_image VARCHAR(512) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_society_flat (society_id, flat_id),
  INDEX idx_flat_id (flat_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS flat_vehicles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  flat_id INT UNSIGNED NOT NULL,
  vehicle_number VARCHAR(64) NOT NULL,
  vehicle_type VARCHAR(32) NOT NULL DEFAULT 'car',
  parking_slot VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_society_flat (society_id, flat_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flat_documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  society_id INT UNSIGNED NOT NULL,
  flat_id INT UNSIGNED NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(64) DEFAULT NULL,
  file_url VARCHAR(512) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_society_flat (society_id, flat_id),
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE,
  FOREIGN KEY (flat_id) REFERENCES flats(id) ON DELETE CASCADE
);
