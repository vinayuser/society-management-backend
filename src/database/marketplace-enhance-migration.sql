-- Enhanced Community & Global Marketplace
-- Run with: node src/database/marketplace-migrate.js

-- marketplace_transactions for buyer-seller tracking
CREATE TABLE IF NOT EXISTS marketplace_transactions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  buyer_user_id INT UNSIGNED NOT NULL,
  seller_user_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  society_id INT UNSIGNED NOT NULL,
  transaction_status ENUM('pending', 'completed', 'canceled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_buyer (buyer_user_id),
  INDEX idx_seller (seller_user_id),
  INDEX idx_item (item_id),
  INDEX idx_society (society_id),
  INDEX idx_status (transaction_status),
  FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE,
  FOREIGN KEY (society_id) REFERENCES societies(id) ON DELETE CASCADE
);
