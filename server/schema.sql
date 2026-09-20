-- Gram Farm AI & Cloud Mining Database Schema for Neon PostgreSQL
-- Database: neondb (Project: Ton mining - wandering-sun-30540688)

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(255) DEFAULT '',
  first_name VARCHAR(255) DEFAULT 'Miner',
  photo_url TEXT,
  ton_wallet_address VARCHAR(255),
  ton_wallet_type VARCHAR(64),
  gram_balance NUMERIC(20, 6) DEFAULT 100.0,
  ton_balance NUMERIC(20, 6) DEFAULT 0.0,
  total_mined NUMERIC(20, 6) DEFAULT 0.0,
  base_hashrate NUMERIC(10, 2) DEFAULT 45.0,
  storage_capacity_hours NUMERIC(6, 2) DEFAULT 3.0,
  last_claim_timestamp BIGINT,
  unclaimed_gram NUMERIC(20, 6) DEFAULT 0.0,
  referral_code VARCHAR(64) UNIQUE,
  referred_by VARCHAR(64),
  referrals_count INTEGER DEFAULT 0,
  referral_earnings NUMERIC(20, 6) DEFAULT 0.0,
  mystery_boxes_available INTEGER DEFAULT 1,
  total_deposited NUMERIC(20, 6) DEFAULT 0.0,
  total_withdrawn NUMERIC(20, 6) DEFAULT 0.0,
  streak_count INTEGER DEFAULT 1,
  last_streak_date VARCHAR(32),
  created_at BIGINT,
  updated_at BIGINT
);

CREATE TABLE IF NOT EXISTS active_plans (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  plan_id VARCHAR(64) NOT NULL,
  plan_name VARCHAR(255) NOT NULL,
  activated_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  hashrate NUMERIC(10, 2) DEFAULT 0.0,
  daily_profit NUMERIC(20, 6) DEFAULT 0.0,
  paid_currency VARCHAR(32) DEFAULT 'GRAM'
);
CREATE INDEX IF NOT EXISTS idx_active_plans_user_id ON active_plans(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255),
  tx_hash VARCHAR(255),
  sender VARCHAR(255),
  destination VARCHAR(255),
  plan_id VARCHAR(64),
  plan_name VARCHAR(255),
  cost VARCHAR(64),
  amount VARCHAR(64),
  is_positive BOOLEAN DEFAULT TRUE,
  status VARCHAR(64) DEFAULT 'Completed',
  timestamp BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

CREATE TABLE IF NOT EXISTS mystery_boxes_history (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  box_name VARCHAR(255),
  box_img TEXT,
  reward_gram NUMERIC(20, 6) DEFAULT 0.0,
  opened_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mystery_boxes_user_id ON mystery_boxes_history(user_id);

CREATE TABLE IF NOT EXISTS completed_tasks (
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  task_id VARCHAR(64) NOT NULL,
  completed_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, task_id)
);

CREATE TABLE IF NOT EXISTS processed_tx_hashes (
  tx_hash VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(64),
  amount NUMERIC(20, 6),
  processed_at BIGINT NOT NULL
);
