import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '../data/db.json');

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('🚀 Starting Data Migration to Neon PostgreSQL (Ton mining)...');

  if (!fs.existsSync(DB_FILE)) {
    console.log('⚠️ No data/db.json file found to migrate.');
    process.exit(0);
  }

  const rawData = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  const users = rawData.users || {};
  const globalTxs = rawData.transactions || [];
  const processedHashes = rawData.processed_tx_hashes || {};

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Migrate Users
    console.log(`👤 Migrating ${Object.keys(users).length} users...`);
    for (const [id, u] of Object.entries(users)) {
      await client.query(
        `INSERT INTO users (
          id, username, first_name, photo_url, ton_wallet_address, ton_wallet_type,
          gram_balance, ton_balance, total_mined, base_hashrate, storage_capacity_hours,
          last_claim_timestamp, unclaimed_gram, referral_code, referred_by, referrals_count,
          referral_earnings, mystery_boxes_available, total_deposited, total_withdrawn,
          streak_count, last_streak_date, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        ) ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          photo_url = EXCLUDED.photo_url,
          ton_wallet_address = EXCLUDED.ton_wallet_address,
          gram_balance = EXCLUDED.gram_balance,
          total_mined = EXCLUDED.total_mined,
          last_claim_timestamp = EXCLUDED.last_claim_timestamp,
          mystery_boxes_available = EXCLUDED.mystery_boxes_available,
          total_deposited = EXCLUDED.total_deposited,
          total_withdrawn = EXCLUDED.total_withdrawn,
          streak_count = EXCLUDED.streak_count,
          last_streak_date = EXCLUDED.last_streak_date`,
        [
          String(id),
          u.username || '',
          u.first_name || 'Miner',
          u.photo_url || null,
          u.ton_wallet_address || null,
          u.ton_wallet_type || null,
          u.gram_balance || 100.0,
          u.ton_balance || 0.0,
          u.total_mined || 0.0,
          u.base_hashrate || 45.0,
          u.storage_capacity_hours || 3.0,
          u.last_claim_timestamp || Date.now(),
          u.unclaimed_gram || 0.0,
          u.referral_code || ('GRAM' + Math.random().toString(36).substring(2, 8).toUpperCase()),
          u.referred_by || null,
          u.referrals_count || 0,
          u.referral_earnings || 0.0,
          u.mystery_boxes_available ?? 1,
          u.total_deposited || 0.0,
          u.total_withdrawn || 0.0,
          u.streak_count || 1,
          u.last_streak_date || new Date().toISOString().split('T')[0],
          u.created_at || Date.now(),
          Date.now()
        ]
      );

      // 2. Migrate User Active Plans
      if (Array.isArray(u.active_plans)) {
        for (const p of u.active_plans) {
          await client.query(
            `INSERT INTO active_plans (
              user_id, plan_id, plan_name, activated_at, expires_at, hashrate, daily_profit, paid_currency
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              String(id),
              p.plan_id || 'starter_miner_1ton',
              p.plan_name || 'Starter Cloud Miner',
              p.activated_at || Date.now(),
              p.expires_at || (Date.now() + 30 * 86400 * 1000),
              p.hashrate || 45.0,
              p.dailyProfit || 0.10,
              p.paid_currency || 'GRAM'
            ]
          );
        }
      }

      // 3. Migrate User Transactions
      if (Array.isArray(u.transactions_history)) {
        for (const tx of u.transactions_history) {
          await client.query(
            `INSERT INTO transactions (
              id, user_id, type, title, tx_hash, sender, destination, plan_id, plan_name, cost, amount, is_positive, status, timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO NOTHING`,
            [
              tx.id || ('tx_' + Math.random().toString(36).substring(2, 9)),
              String(id),
              tx.type || 'BONUS',
              tx.title || 'Reward',
              tx.txHash || null,
              tx.sender || null,
              tx.destination || null,
              tx.planId || null,
              tx.planName || null,
              tx.cost || null,
              tx.amount || '0 GRAM',
              tx.isPositive !== false,
              tx.status || 'Completed',
              tx.timestamp || Date.now()
            ]
          );
        }
      }

      // 4. Migrate Mystery Boxes History
      if (Array.isArray(u.opened_boxes_history)) {
        for (const box of u.opened_boxes_history) {
          await client.query(
            `INSERT INTO mystery_boxes_history (
              id, user_id, box_name, box_img, reward_gram, opened_at
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING`,
            [
              box.id || ('box_' + Math.random().toString(36).substring(2, 9)),
              String(id),
              box.boxName || 'Mystery Box',
              box.boxImg || '/assets/box-ton.jpg',
              box.rewardGram || 0.02,
              box.openedAt || Date.now()
            ]
          );
        }
      }

      // 5. Migrate Completed Tasks
      if (u.completed_tasks && typeof u.completed_tasks === 'object') {
        for (const [taskId, ts] of Object.entries(u.completed_tasks)) {
          await client.query(
            `INSERT INTO completed_tasks (user_id, task_id, completed_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, task_id) DO NOTHING`,
            [String(id), taskId, typeof ts === 'number' ? ts : Date.now()]
          );
        }
      }
    }

    // 6. Migrate Global Transactions
    console.log(`💳 Migrating ${globalTxs.length} global transactions...`);
    for (const tx of globalTxs) {
      if (tx.id) {
        await client.query(
          `INSERT INTO transactions (
            id, user_id, type, title, tx_hash, sender, destination, plan_id, plan_name, cost, amount, is_positive, status, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO NOTHING`,
          [
            tx.id,
            tx.userId ? String(tx.userId) : null,
            tx.type || 'SYSTEM',
            tx.title || tx.type || 'Transaction',
            tx.txHash || null,
            tx.sender || null,
            tx.destination || null,
            tx.planId || null,
            tx.planName || null,
            tx.cost || null,
            tx.amount || '0 GRAM',
            tx.isPositive !== false,
            tx.status || 'Completed',
            tx.timestamp || Date.now()
          ]
        );
      }
    }

    // 7. Migrate Processed Hashes
    console.log(`🔐 Migrating ${Object.keys(processedHashes).length} processed transaction hashes...`);
    for (const [hash, data] of Object.entries(processedHashes)) {
      const uId = typeof data === 'object' ? data.userId : null;
      const amt = typeof data === 'object' ? data.amount : null;
      const tAt = typeof data === 'object' ? data.processed_at : Date.now();
      await client.query(
        `INSERT INTO processed_tx_hashes (tx_hash, user_id, amount, processed_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tx_hash) DO NOTHING`,
        [hash, uId ? String(uId) : null, amt || 0, tAt || Date.now()]
      );
    }

    await client.query('COMMIT');
    console.log('✅ All data successfully migrated to Neon PostgreSQL (Ton mining)!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
