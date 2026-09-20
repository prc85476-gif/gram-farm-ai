import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const { Pool } = pg;
let pool = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    console.log('🐘 [Neon PostgreSQL] Initialized connection pool for Ton mining database.');
  } catch (err) {
    console.error('⚠️ [Neon PostgreSQL] Failed to initialize pool:', err.message);
  }
}

// Mining & Investment Plans (100% GRAM Token Powered)
export const MINING_PLANS = [
  {
    id: 'starter_miner_1ton',
    name: 'Starter Cloud Miner',
    tier: 'Tier 1',
    hashrate: 45.0, // GH/s
    dailyProfit: 0.10, // GRAM / day
    totalReturnGram: 3.00, // 3.00 GRAM total return
    roiPercent: '300%',
    durationDays: 30,
    priceGram: 1,
    isFree: false,
    color: '#00d2ff', // Electric Cyan
    badge: '1 GRAM',
    description: 'Mine 0.10 GRAM daily for 30 days to yield 3.00 GRAM total return.'
  },
  {
    id: 'pro_farm_5ton',
    name: 'Pro Dual Rig',
    tier: 'Tier 2',
    hashrate: 250.0, // GH/s
    dailyProfit: 0.55, // GRAM / day
    totalReturnGram: 16.50, // 16.50 GRAM total return
    roiPercent: '330%',
    durationDays: 30,
    priceGram: 5,
    isFree: false,
    color: '#10b981', // Emerald Green
    badge: '5 GRAM',
    description: 'Mine 0.55 GRAM daily for 30 days to yield 16.50 GRAM total return.'
  },
  {
    id: 'asic_turbo_10ton',
    name: 'ASIC Turbo X9',
    tier: 'Tier 3',
    hashrate: 650.0, // GH/s
    dailyProfit: 1.17, // GRAM / day
    totalReturnGram: 35.00, // 35.00 GRAM total return
    roiPercent: '350%',
    durationDays: 30,
    priceGram: 10,
    isFree: false,
    color: '#f59e0b', // Solar Gold
    badge: '10 GRAM',
    description: 'Mine 1.17 GRAM daily for 30 days to yield 35.00 GRAM total return.'
  },
  {
    id: 'quantum_node_25ton',
    name: 'Quantum Supercluster',
    tier: 'Tier 4',
    hashrate: 2000.0, // GH/s
    dailyProfit: 3.17, // GRAM / day
    totalReturnGram: 95.00, // 95.00 GRAM total return
    roiPercent: '380%',
    durationDays: 30,
    priceGram: 25,
    isFree: false,
    color: '#c084fc', // Royal Purple
    badge: '25 GRAM',
    description: 'Mine 3.17 GRAM daily for 30 days to yield 95.00 GRAM total return.'
  }
];

export const MYSTERY_BOX_TYPES = [
  {
    id: 'box_gram_crystal',
    name: 'GRAM Crystal Mystery Box',
    img: '/assets/box-ton.jpg',
    color: '#00d2ff',
    rarity: 'Rare'
  },
  {
    id: 'box_gram_cyber',
    name: 'GRAM Cyber Mystery Box',
    img: '/assets/box-gram.jpg',
    color: '#a855f7',
    rarity: 'Epic'
  },
  {
    id: 'box_gold_rpg',
    name: 'Golden RPG Treasure Crate',
    img: '/assets/box-gold.jpg',
    color: '#fbbf24',
    rarity: 'Legendary'
  }
];

// Tasks Catalog (Daily 0.01 GRAM, TG Join 0.10 GRAM, Invite 100 = 1 TON)
export const TASKS_CATALOG = [
  {
    id: 'daily_checkin',
    title: 'Daily Mining Bonus',
    rewardAmount: 0.01,
    rewardCurrency: 'GRAM',
    rewardGram: 0.01,
    rewardTon: 0,
    icon: 'calendar',
    category: 'daily',
    description: 'Check in every 24 hours to claim +0.0100 GRAM bonus!'
  },
  {
    id: 'join_tg_channel',
    title: 'Join Gram Farm Channel',
    rewardAmount: 0.10,
    rewardCurrency: 'GRAM',
    rewardGram: 0.10,
    rewardTon: 0,
    icon: 'telegram',
    link: 'https://t.me/GramfarmAimining',
    channelUsername: '@GramfarmAimining',
    category: 'social',
    description: 'Join @GramfarmAimining official channel on Telegram to earn +0.10 GRAM.'
  },
  {
    id: 'invite_100_friends',
    title: 'Invite 100 Mining Buddies',
    rewardAmount: 1.00,
    rewardCurrency: 'TON',
    rewardTon: 1.00,
    rewardGram: 0,
    icon: 'users',
    category: 'referral',
    requiredInvites: 100,
    description: 'Bring 100 friends into Gram Farm and claim 1.00 TON bonus reward!'
  }
];

const DEFAULT_DATA = {
  users: {},
  transactions: [],
  processed_tx_hashes: {},
  gift_codes: {},
  withdrawals: {},
  admin_chats: {}
};

class Database {
  constructor() {
    this.data = this.loadLocal();
    if (!this.data.gift_codes) this.data.gift_codes = {};
    if (!this.data.withdrawals) this.data.withdrawals = {};
    if (!this.data.admin_chats) this.data.admin_chats = {};
    this.initPostgres();
  }

  loadLocal() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed.gift_codes) parsed.gift_codes = {};
        if (!parsed.withdrawals) parsed.withdrawals = {};
        if (!parsed.admin_chats) parsed.admin_chats = {};
        return parsed;
      }
    } catch (e) {
      console.error('Error loading local database fallback:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  async initPostgres() {
    if (!pool) return;
    try {
      // Test connection
      const client = await pool.connect();
      console.log('✅ [Neon PostgreSQL] Connected to Ton mining database successfully.');

      // Ensure Gift Code, Withdrawals, ban columns and admin_chats exist
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT '';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at BIGINT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS channels_verified BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS channels_verified_at BIGINT;

        CREATE TABLE IF NOT EXISTS admin_chats (
          chat_id VARCHAR(64) PRIMARY KEY,
          username TEXT DEFAULT '',
          first_name TEXT DEFAULT '',
          registered_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS gift_codes (
          id VARCHAR(64) PRIMARY KEY,
          code VARCHAR(64) UNIQUE NOT NULL,
          reward_gram NUMERIC(20, 6) NOT NULL,
          max_claims INTEGER DEFAULT 1,
          claimed_count INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at BIGINT NOT NULL,
          expires_at BIGINT
        );

        CREATE TABLE IF NOT EXISTS gift_code_claims (
          id VARCHAR(64) PRIMARY KEY,
          code_id VARCHAR(64) NOT NULL,
          code VARCHAR(64) NOT NULL,
          user_id VARCHAR(64) NOT NULL,
          reward_gram NUMERIC(20, 6) NOT NULL,
          claimed_at BIGINT NOT NULL,
          UNIQUE(code_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS withdrawals (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          amount NUMERIC(20, 6) NOT NULL,
          destination VARCHAR(128) NOT NULL,
          status VARCHAR(32) DEFAULT 'PENDING',
          tx_hash VARCHAR(128),
          created_at BIGINT NOT NULL,
          processed_at BIGINT,
          note TEXT
        );
      `);

      // Pre-seed primary admin Dark Duo (8829204942) and env ADMIN_TELEGRAM_ID
      const defaultAdmins = ['8829204942'];
      if (process.env.ADMIN_TELEGRAM_ID) {
        defaultAdmins.push(String(process.env.ADMIN_TELEGRAM_ID).trim());
      }
      for (const adminId of defaultAdmins) {
        if (adminId) {
          await client.query(
            `INSERT INTO admin_chats (chat_id, username, first_name, registered_at)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (chat_id) DO NOTHING`,
            [adminId, 'Admin', 'Admin', Date.now()]
          ).catch(() => {});
        }
      }

      // Load all data from Neon PostgreSQL into memory
      await this.loadFromPostgres(client);
      client.release();
    } catch (err) {
      console.error('❌ [Neon PostgreSQL] Error during initialization:', err.message);
    }
  }

  async loadFromPostgres(client) {
    try {
      const usersRes = await client.query('SELECT * FROM users');
      const activePlansRes = await client.query('SELECT * FROM active_plans');
      const txsRes = await client.query('SELECT * FROM transactions ORDER BY timestamp DESC');
      const boxesRes = await client.query('SELECT * FROM mystery_boxes_history ORDER BY opened_at DESC');
      const tasksRes = await client.query('SELECT * FROM completed_tasks');
      const hashesRes = await client.query('SELECT * FROM processed_tx_hashes');
      const giftCodesRes = await client.query('SELECT * FROM gift_codes ORDER BY created_at DESC');
      const claimsRes = await client.query('SELECT * FROM gift_code_claims');
      const withdrawalsRes = await client.query('SELECT * FROM withdrawals ORDER BY created_at DESC');
      const adminChatsRes = await client.query('SELECT * FROM admin_chats');

      const loadedUsers = {};

      for (const row of usersRes.rows) {
        const id = String(row.id);
        loadedUsers[id] = {
          id,
          username: row.username || '',
          first_name: row.first_name || 'Miner',
          photo_url: row.photo_url || null,
          ton_wallet_address: row.ton_wallet_address || null,
          ton_wallet_type: row.ton_wallet_type || null,
          gram_balance: parseFloat(row.gram_balance) || 0.0,
          deposit_balance: parseFloat(row.deposit_balance) || 0.0,
          ton_balance: parseFloat(row.ton_balance) || 0.0,
          total_mined: parseFloat(row.total_mined) || 0.0,
          base_hashrate: parseFloat(row.base_hashrate) || 15.0,
          storage_capacity_hours: parseFloat(row.storage_capacity_hours) || 3.0,
          last_claim_timestamp: parseInt(row.last_claim_timestamp) || Date.now(),
          unclaimed_gram: parseFloat(row.unclaimed_gram) || 0.0,
          referral_code: row.referral_code || ('GRAM' + Math.random().toString(36).substring(2, 8).toUpperCase()),
          referred_by: row.referred_by || null,
          referrals_count: parseInt(row.referrals_count) || 0,
          referral_earnings: parseFloat(row.referral_earnings) || 0.0,
          mystery_boxes_available: parseInt(row.mystery_boxes_available) ?? 0,
          total_deposited: parseFloat(row.total_deposited) || 0.0,
          total_withdrawn: parseFloat(row.total_withdrawn) || 0.0,
          streak_count: parseInt(row.streak_count) || 1,
          last_streak_date: row.last_streak_date || new Date().toISOString().split('T')[0],
          is_banned: Boolean(row.is_banned || false),
          ban_reason: row.ban_reason || '',
          banned_at: row.banned_at ? parseInt(row.banned_at) : null,
          channels_verified: Boolean(row.channels_verified || false),
          channels_verified_at: row.channels_verified_at ? parseInt(row.channels_verified_at) : null,
          created_at: parseInt(row.created_at) || Date.now(),
          active_plans: [],
          transactions_history: [],
          opened_boxes_history: [],
          completed_tasks: {}
        };
      }

      for (const row of activePlansRes.rows) {
        const uId = String(row.user_id);
        if (loadedUsers[uId]) {
          loadedUsers[uId].active_plans.push({
            id: row.id,
            plan_id: row.plan_id,
            plan_name: row.plan_name,
            activated_at: parseInt(row.activated_at),
            expires_at: parseInt(row.expires_at),
            hashrate: parseFloat(row.hashrate),
            dailyProfit: parseFloat(row.daily_profit),
            paid_currency: row.paid_currency || 'GRAM'
          });
        }
      }

      for (const row of txsRes.rows) {
        const uId = String(row.user_id);
        const txObj = {
          id: row.id,
          type: row.type,
          title: row.title,
          txHash: row.tx_hash,
          sender: row.sender,
          destination: row.destination,
          planId: row.plan_id,
          planName: row.plan_name,
          cost: row.cost,
          amount: row.amount,
          isPositive: row.is_positive,
          status: row.status,
          timestamp: parseInt(row.timestamp)
        };
        if (loadedUsers[uId]) {
          loadedUsers[uId].transactions_history.push(txObj);
        }
      }

      for (const row of boxesRes.rows) {
        const uId = String(row.user_id);
        if (loadedUsers[uId]) {
          loadedUsers[uId].opened_boxes_history.push({
            id: row.id,
            boxName: row.box_name,
            boxImg: row.box_img,
            rewardGram: parseFloat(row.reward_gram),
            openedAt: parseInt(row.opened_at)
          });
        }
      }

      for (const row of tasksRes.rows) {
        const uId = String(row.user_id);
        if (loadedUsers[uId]) {
          loadedUsers[uId].completed_tasks[row.task_id] = parseInt(row.completed_at);
        }
      }

      const processed = {};
      for (const row of hashesRes.rows) {
        processed[row.tx_hash] = {
          userId: row.user_id,
          amount: parseFloat(row.amount),
          timestamp: parseInt(row.processed_at)
        };
      }

      const loadedGiftCodes = {};
      for (const row of giftCodesRes.rows) {
        const id = String(row.id);
        loadedGiftCodes[id] = {
          id,
          code: row.code,
          rewardGram: parseFloat(row.reward_gram),
          maxClaims: parseInt(row.max_claims) || 1,
          claimedCount: parseInt(row.claimed_count) || 0,
          isActive: row.is_active !== false,
          createdAt: parseInt(row.created_at) || Date.now(),
          expiresAt: row.expires_at ? parseInt(row.expires_at) : null,
          claimedBy: {}
        };
      }

      for (const row of claimsRes.rows) {
        const codeId = String(row.code_id);
        if (loadedGiftCodes[codeId]) {
          loadedGiftCodes[codeId].claimedBy[String(row.user_id)] = parseInt(row.claimed_at);
        }
      }

      const loadedWithdrawals = {};
      for (const row of withdrawalsRes.rows) {
        const id = String(row.id);
        loadedWithdrawals[id] = {
          id,
          userId: String(row.user_id),
          user_id: String(row.user_id),
          amount: parseFloat(row.amount),
          destination: row.destination,
          status: row.status || 'PENDING',
          txHash: row.tx_hash || null,
          tx_hash: row.tx_hash || null,
          createdAt: parseInt(row.created_at) || Date.now(),
          created_at: parseInt(row.created_at) || Date.now(),
          processedAt: row.processed_at ? parseInt(row.processed_at) : null,
          processed_at: row.processed_at ? parseInt(row.processed_at) : null,
          note: row.note || ''
        };
      }

      const loadedAdminChats = {};
      for (const row of (adminChatsRes?.rows || [])) {
        const id = String(row.chat_id);
        loadedAdminChats[id] = {
          chatId: id,
          username: row.username || '',
          firstName: row.first_name || '',
          registeredAt: parseInt(row.registered_at) || Date.now()
        };
      }

      this.data.users = loadedUsers;
      this.data.processed_tx_hashes = processed;
      this.data.gift_codes = loadedGiftCodes;
      this.data.withdrawals = loadedWithdrawals;
      this.data.admin_chats = loadedAdminChats;
      console.log(`📦 [Neon PostgreSQL] Synchronized ${Object.keys(loadedUsers).length} users, ${Object.keys(loadedGiftCodes).length} gift codes, ${Object.keys(loadedWithdrawals).length} withdrawals & ${Object.keys(loadedAdminChats).length} admin chats into state.`);
      this.saveLocal();
    } catch (err) {
      console.error('❌ [Neon PostgreSQL] Failed to load data:', err.message);
    }
  }

  saveLocal() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving local database:', e);
    }
  }

  save() {
    this.saveLocal();
    this.syncAllToPostgres();
  }

  async syncAllToPostgres() {
    if (!pool) return;
    try {
      for (const [id, user] of Object.entries(this.data.users)) {
        await this.syncUserToPostgres(id, user);
      }
    } catch (e) {
      console.error('⚠️ [Neon PostgreSQL] Background sync error:', e.message);
    }
  }

  async syncUserToPostgres(userId, user) {
    if (!pool || !user) return;
    try {
      const query = `
        INSERT INTO users (
          id, username, first_name, photo_url, ton_wallet_address, ton_wallet_type,
          gram_balance, deposit_balance, ton_balance, total_mined, base_hashrate, storage_capacity_hours,
          last_claim_timestamp, unclaimed_gram, referral_code, referred_by, referrals_count,
          referral_earnings, mystery_boxes_available, total_deposited, total_withdrawn,
          streak_count, last_streak_date, is_banned, ban_reason, banned_at,
          channels_verified, channels_verified_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
        ) ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username,
          first_name = EXCLUDED.first_name,
          photo_url = EXCLUDED.photo_url,
          ton_wallet_address = EXCLUDED.ton_wallet_address,
          ton_wallet_type = EXCLUDED.ton_wallet_type,
          gram_balance = EXCLUDED.gram_balance,
          deposit_balance = EXCLUDED.deposit_balance,
          ton_balance = EXCLUDED.ton_balance,
          total_mined = EXCLUDED.total_mined,
          last_claim_timestamp = EXCLUDED.last_claim_timestamp,
          unclaimed_gram = EXCLUDED.unclaimed_gram,
          referral_code = COALESCE(users.referral_code, EXCLUDED.referral_code),
          referred_by = COALESCE(EXCLUDED.referred_by, users.referred_by),
          referrals_count = EXCLUDED.referrals_count,
          referral_earnings = EXCLUDED.referral_earnings,
          mystery_boxes_available = EXCLUDED.mystery_boxes_available,
          total_deposited = EXCLUDED.total_deposited,
          total_withdrawn = EXCLUDED.total_withdrawn,
          streak_count = EXCLUDED.streak_count,
          last_streak_date = EXCLUDED.last_streak_date,
          is_banned = EXCLUDED.is_banned,
          ban_reason = EXCLUDED.ban_reason,
          banned_at = EXCLUDED.banned_at,
          channels_verified = EXCLUDED.channels_verified,
          channels_verified_at = EXCLUDED.channels_verified_at,
          updated_at = EXCLUDED.updated_at;
      `;

      await pool.query(query, [
        String(userId),
        user.username || '',
        user.first_name || 'Miner',
        user.photo_url || null,
        user.ton_wallet_address || null,
        user.ton_wallet_type || null,
        user.gram_balance || 0.0,
        user.deposit_balance || 0.0,
        user.ton_balance || 0.0,
        user.total_mined || 0.0,
        user.base_hashrate || 15.0,
        user.storage_capacity_hours || 3.0,
        user.last_claim_timestamp || Date.now(),
        user.unclaimed_gram || 0.0,
        user.referral_code || ('GRAM' + Math.random().toString(36).substring(2, 8).toUpperCase()),
        user.referred_by || null,
        user.referrals_count || 0,
        user.referral_earnings || 0.0,
        user.mystery_boxes_available ?? 0,
        user.total_deposited || 0.0,
        user.total_withdrawn || 0.0,
        user.streak_count || 1,
        user.last_streak_date || new Date().toISOString().split('T')[0],
        Boolean(user.is_banned || false),
        user.ban_reason || '',
        user.banned_at || null,
        Boolean(user.channels_verified || false),
        user.channels_verified_at || null,
        user.created_at || Date.now(),
        Date.now()
      ]);
    } catch (err) {
      console.error(`⚠️ [Neon PostgreSQL] Error saving user ${userId}:`, err.message);
    }
  }

  getUser(userId) {
    const id = String(userId);
    if (!this.data.users[id]) {
      const refCode = 'GRAM' + Math.random().toString(36).substring(2, 8).toUpperCase();
      this.data.users[id] = {
        id,
        username: '',
        first_name: 'Miner',
        photo_url: null,
        ton_wallet_address: null,
        ton_wallet_type: null,
        gram_balance: 0.0,
        deposit_balance: 0.0,
        ton_balance: 0.0,
        total_mined: 0.0,
        base_hashrate: 15.0,
        storage_capacity_hours: 3.0,
        last_claim_timestamp: Date.now(),
        unclaimed_gram: 0.0,
        referral_code: refCode,
        referred_by: null,
        referrals_count: 0,
        referral_earnings: 0.0,
        mystery_boxes_available: 0,
        opened_boxes_history: [],
        total_deposited: 0.0,
        total_withdrawn: 0.0,
        transactions_history: [],
        active_plans: [],
        completed_tasks: {},
        streak_count: 1,
        last_streak_date: new Date().toISOString().split('T')[0],
        is_banned: false,
        ban_reason: '',
        banned_at: null,
        channels_verified: false,
        channels_verified_at: null,
        created_at: Date.now()
      };
      this.saveLocal();
      this.syncUserToPostgres(id, this.data.users[id]);
    }

    const raw = this.data.users[id];
    if (raw.deposit_balance === undefined) raw.deposit_balance = 0.0;
    if (raw.mystery_boxes_available === undefined) raw.mystery_boxes_available = 0;
    if (!raw.opened_boxes_history) raw.opened_boxes_history = [];
    if (raw.total_deposited === undefined) raw.total_deposited = 0.0;
    if (raw.total_withdrawn === undefined) raw.total_withdrawn = 0.0;
    if (!raw.transactions_history) raw.transactions_history = [];
    if (!raw.active_plans) raw.active_plans = [];
    if (raw.is_banned === undefined) raw.is_banned = false;
    if (raw.ban_reason === undefined) raw.ban_reason = '';
    if (raw.channels_verified === undefined) raw.channels_verified = false;

    return this.calculateLiveMining(raw);
  }

  setChannelsVerified(userId) {
    const id = String(userId);
    this.getUser(id);
    const raw = this.data.users[id];
    if (raw) {
      raw.channels_verified = true;
      raw.channels_verified_at = Date.now();
      this.save();
    }
    return { success: true, user: this.getUser(id) };
  }

  syncUser(userId, profileData = {}) {
    const id = String(userId);
    const user = this.getUser(id);
    const raw = this.data.users[id];
    if (raw) {
      if (profileData.first_name) raw.first_name = profileData.first_name;
      if (profileData.username !== undefined) raw.username = profileData.username;
      if (profileData.photo_url) raw.photo_url = profileData.photo_url;
      this.save();
    }
    return this.calculateLiveMining(raw || user);
  }

  calculateLiveMining(user) {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - user.last_claim_timestamp) / 1000);
    
    let totalHashrate = user.base_hashrate || 15.0;
    let totalDailyProfit = 0.10; // Free base mining: 0.10 GRAM / Day

    (user.active_plans || []).forEach(plan => {
      if (!plan.expires_at || plan.expires_at > now) {
        totalHashrate += plan.hashrate || 0;
        totalDailyProfit += plan.dailyProfit || 0;
      }
    });

    const gramPerSecond = totalDailyProfit / 86400;
    // 3 hours cycle storage capacity = (totalDailyProfit / 24) * 3
    const maxStorageCapacityGram = (totalDailyProfit / 24) * (user.storage_capacity_hours || 3.0);

    const minedGram = Math.min(maxStorageCapacityGram, elapsedSeconds * gramPerSecond);
    const storagePercent = maxStorageCapacityGram > 0 ? Math.min(100, (minedGram / maxStorageCapacityGram) * 100) : 0;

    return {
      ...user,
      current_hashrate: Number(totalHashrate.toFixed(1)),
      daily_yield_gram: Number(totalDailyProfit.toFixed(4)),
      gram_per_second: gramPerSecond,
      unclaimed_gram: Number(minedGram.toFixed(6)),
      max_storage_gram: Number(maxStorageCapacityGram.toFixed(6)),
      storage_percent: Number(storagePercent.toFixed(2)),
      is_storage_full: minedGram >= maxStorageCapacityGram
    };
  }

  claimMining(userId) {
    const user = this.getUser(userId);
    const unclaimed = user.unclaimed_gram;
    if (unclaimed < 0.01) {
      return { 
        success: false, 
        message: `Minimum claim amount is 0.01 GRAM. (Currently accumulated: ${unclaimed.toFixed(5)} GRAM)` 
      };
    }

    const rawUser = this.data.users[String(userId)];
    rawUser.gram_balance = Number((rawUser.gram_balance + unclaimed).toFixed(6));
    rawUser.total_mined = Number((rawUser.total_mined + unclaimed).toFixed(6));
    rawUser.last_claim_timestamp = Date.now();
    
    // 10% Lifetime Mining Commission to referrer
    if (rawUser.referred_by && this.data.users[rawUser.referred_by]) {
      const refBonus = Number((unclaimed * 0.10).toFixed(6));
      this.data.users[rawUser.referred_by].gram_balance = Number(
        (this.data.users[rawUser.referred_by].gram_balance + refBonus).toFixed(6)
      );
      this.data.users[rawUser.referred_by].referral_earnings = Number(
        (this.data.users[rawUser.referred_by].referral_earnings + refBonus).toFixed(6)
      );
    }

    this.save();
    return {
      success: true,
      claimed: unclaimed,
      new_balance: rawUser.gram_balance,
      user: this.getUser(userId)
    };
  }

  buyPlan(userId, planId) {
    const plan = MINING_PLANS.find(p => p.id === planId);
    if (!plan) return { success: false, message: 'Invalid plan selected' };

    const id = String(userId);
    this.getUser(id);
    const rawUser = this.data.users[id];

    const currentStatus = this.calculateLiveMining(rawUser);
    if (currentStatus.unclaimed_gram > 0) {
      rawUser.gram_balance = Number(((rawUser.gram_balance || 0) + currentStatus.unclaimed_gram).toFixed(6));
      rawUser.total_mined = Number(((rawUser.total_mined || 0) + currentStatus.unclaimed_gram).toFixed(6));
    }
    rawUser.last_claim_timestamp = Date.now();

    const depositBal = Number(rawUser.deposit_balance || 0);
    const availBal = Number(rawUser.gram_balance || 0);
    const totalPurchasingPower = Number((depositBal + availBal).toFixed(4));

    if (totalPurchasingPower < plan.priceGram) {
      return { 
        success: false, 
        message: `Insufficient balance. Required: ${plan.priceGram.toLocaleString()} GRAM. (Deposit: ${depositBal.toFixed(2)} GRAM, Available: ${availBal.toFixed(2)} GRAM)` 
      };
    }

    // Deduct from Deposit Balance first, and remainder from Available Balance
    let remainingCost = plan.priceGram;
    if (depositBal >= remainingCost) {
      rawUser.deposit_balance = Number((depositBal - remainingCost).toFixed(4));
      remainingCost = 0;
    } else {
      remainingCost = Number((remainingCost - depositBal).toFixed(4));
      rawUser.deposit_balance = 0.0;
      rawUser.gram_balance = Number((availBal - remainingCost).toFixed(4));
    }

    const newPlanObj = {
      plan_id: plan.id,
      plan_name: plan.name,
      activated_at: Date.now(),
      expires_at: Date.now() + plan.durationDays * 86400 * 1000,
      hashrate: plan.hashrate,
      dailyProfit: plan.dailyProfit,
      paid_currency: 'GRAM'
    };

    rawUser.active_plans.push(newPlanObj);

    const txObj = {
      id: 'tx_p_' + Date.now(),
      type: 'PLAN_PURCHASE',
      title: `Activated ${plan.name}`,
      planId: plan.id,
      planName: plan.name,
      cost: `${plan.priceGram.toLocaleString()} GRAM`,
      amount: `-${plan.priceGram.toLocaleString()} GRAM`,
      isPositive: false,
      status: 'Completed',
      timestamp: Date.now()
    };

    if (!rawUser.transactions_history) rawUser.transactions_history = [];
    rawUser.transactions_history.unshift(txObj);

    if (pool) {
      pool.query(
        `INSERT INTO active_plans (user_id, plan_id, plan_name, activated_at, expires_at, hashrate, daily_profit, paid_currency)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, newPlanObj.plan_id, newPlanObj.plan_name, newPlanObj.activated_at, newPlanObj.expires_at, newPlanObj.hashrate, newPlanObj.dailyProfit, 'GRAM']
      ).catch(e => console.error('Error persisting active plan to Neon:', e.message));

      pool.query(
        `INSERT INTO transactions (id, user_id, type, title, plan_id, plan_name, cost, amount, is_positive, status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [txObj.id, id, txObj.type, txObj.title, txObj.planId, txObj.planName, txObj.cost, txObj.amount, txObj.isPositive, txObj.status, txObj.timestamp]
      ).catch(e => console.error('Error persisting transaction to Neon:', e.message));
    }

    this.save();
    return {
      success: true,
      message: `Activated ${plan.name}! Generating ${plan.dailyProfit} GRAM/day (${plan.totalReturnGram} GRAM total yield).`,
      user: this.getUser(userId)
    };
  }

  // Open Mystery Gift Box (Reward: 0.0100 to 0.0500 GRAM)
  openMysteryBox(userId) {
    const id = String(userId);
    this.getUser(id);
    const rawUser = this.data.users[id];

    if (!rawUser.mystery_boxes_available || rawUser.mystery_boxes_available <= 0) {
      return { success: false, message: 'No unopened Mystery Boxes available! Invite a friend to earn +1 Gift Box.' };
    }

    rawUser.mystery_boxes_available = Math.max(0, rawUser.mystery_boxes_available - 1);

    // Random prize between 0.0100 and 0.0500 GRAM
    const rewardGram = Number((0.0100 + Math.random() * 0.0400).toFixed(4));

    // Random box graphic
    const randomBox = MYSTERY_BOX_TYPES[Math.floor(Math.random() * MYSTERY_BOX_TYPES.length)];

    rawUser.gram_balance = Number(((rawUser.gram_balance || 0) + rewardGram).toFixed(4));

    const boxRecord = {
      id: 'box_' + Date.now(),
      boxName: randomBox.name,
      boxImg: randomBox.img,
      rewardGram: rewardGram,
      openedAt: Date.now()
    };

    if (!rawUser.opened_boxes_history) rawUser.opened_boxes_history = [];
    rawUser.opened_boxes_history.unshift(boxRecord);

    if (rawUser.opened_boxes_history.length > 10) {
      rawUser.opened_boxes_history = rawUser.opened_boxes_history.slice(0, 10);
    }

    const txRecord = {
      id: 'tx_b_' + Date.now(),
      type: 'GIFT_BOX',
      title: `${randomBox.name} Unboxed`,
      amount: `+${rewardGram} GRAM`,
      isPositive: true,
      status: 'Completed',
      timestamp: Date.now()
    };

    if (!rawUser.transactions_history) rawUser.transactions_history = [];
    rawUser.transactions_history.unshift(txRecord);

    if (pool) {
      pool.query(
        `INSERT INTO mystery_boxes_history (id, user_id, box_name, box_img, reward_gram, opened_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [boxRecord.id, id, boxRecord.boxName, boxRecord.boxImg, boxRecord.rewardGram, boxRecord.openedAt]
      ).catch(e => console.error('Error persisting mystery box to Neon:', e.message));

      pool.query(
        `INSERT INTO transactions (id, user_id, type, title, amount, is_positive, status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [txRecord.id, id, txRecord.type, txRecord.title, txRecord.amount, txRecord.isPositive, txRecord.status, txRecord.timestamp]
      ).catch(e => console.error('Error persisting transaction to Neon:', e.message));
    }

    this.save();

    return {
      success: true,
      box: randomBox,
      rewardGram: rewardGram,
      message: `Unboxed ${randomBox.name}! You won +${rewardGram} GRAM!`,
      user: this.getUser(userId)
    };
  }

  // Withdraw GRAM funds to Tonkeeper wallet (Recorded in withdrawals table with PENDING status for Admin Approval)
  withdrawFunds(userId, amount) {
    const id = String(userId);
    this.getUser(id);
    const rawUser = this.data.users[id];

    const withdrawAmt = Number(amount);
    if (isNaN(withdrawAmt) || withdrawAmt < 1) {
      return { success: false, message: 'Minimum withdrawal amount is 1.00 GRAM' };
    }

    if (!rawUser.ton_wallet_address) {
      return { success: false, message: 'Please connect a Tonkeeper wallet first' };
    }

    const availBal = Number(rawUser.gram_balance || 0);
    if (availBal < withdrawAmt) {
      return { 
        success: false, 
        message: `Insufficient Available Balance. Available for withdrawal: ${availBal.toFixed(2)} GRAM. (Deposited funds cannot be withdrawn directly; only claimed/mined rewards are withdrawable).` 
      };
    }

    // Deduct available balance immediately to prevent double spending
    rawUser.gram_balance = Number((availBal - withdrawAmt).toFixed(4));

    const withdrawalId = 'wd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const wdRecord = {
      id: withdrawalId,
      userId: id,
      user_id: id,
      amount: withdrawAmt,
      destination: rawUser.ton_wallet_address,
      status: 'PENDING',
      txHash: null,
      tx_hash: null,
      createdAt: Date.now(),
      created_at: Date.now(),
      processedAt: null,
      processed_at: null,
      note: ''
    };

    if (!this.data.withdrawals) this.data.withdrawals = {};
    this.data.withdrawals[withdrawalId] = wdRecord;

    const txRecord = {
      id: 'tx_w_' + Date.now(),
      withdrawalId: withdrawalId,
      type: 'WITHDRAW',
      title: 'Withdrawal to Wallet',
      destination: rawUser.ton_wallet_address,
      amount: `-${withdrawAmt.toFixed(2)} GRAM`,
      isPositive: false,
      status: 'PENDING',
      timestamp: Date.now()
    };

    if (!rawUser.transactions_history) rawUser.transactions_history = [];
    rawUser.transactions_history.unshift(txRecord);

    if (pool) {
      pool.query(
        `INSERT INTO withdrawals (id, user_id, amount, destination, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [withdrawalId, id, withdrawAmt, wdRecord.destination, 'PENDING', wdRecord.createdAt]
      ).catch(e => console.error('Error persisting withdrawal to Neon:', e.message));

      pool.query(
        `INSERT INTO transactions (id, user_id, type, title, destination, amount, is_positive, status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [txRecord.id, id, txRecord.type, txRecord.title, txRecord.destination, txRecord.amount, txRecord.isPositive, txRecord.status, txRecord.timestamp]
      ).catch(e => console.error('Error persisting transaction to Neon:', e.message));
    }

    this.save();
    return {
      success: true,
      message: `Withdrawal request for ${withdrawAmt.toFixed(2)} GRAM submitted successfully! Status: PENDING (Admin will process your on-chain payout).`,
      withdrawal: wdRecord,
      user: this.getUser(userId)
    };
  }

  // Deposit funds (GRAM / Tonkeeper) - Minimum 1 GRAM with Replay Protection
  depositFunds(userId, amountGram = 0, txHash = '', senderAddress = '') {
    const id = String(userId);
    this.getUser(id);
    const rawUser = this.data.users[id];

    const gram = Number(amountGram);
    if (isNaN(gram) || gram < 1) {
      return { success: false, message: 'Minimum deposit amount is 1.00 GRAM' };
    }

    const cleanHash = txHash ? String(txHash).trim() : ('tx_' + Math.random().toString(36).substring(2, 10));

    if (!this.data.processed_tx_hashes) this.data.processed_tx_hashes = {};
    if (this.data.processed_tx_hashes[cleanHash]) {
      return {
        success: false,
        message: 'This Transaction ID has already been credited! Each transaction can only be claimed once.'
      };
    }

    // Credits deposit_balance (for buying rigs) and total_deposited (Does NOT add to withdrawable gram_balance)
    rawUser.deposit_balance = Number(((rawUser.deposit_balance || 0) + gram).toFixed(4));
    rawUser.total_deposited = Number(((rawUser.total_deposited || 0) + gram).toFixed(2));

    this.data.processed_tx_hashes[cleanHash] = {
      userId: id,
      amount: gram,
      sender: senderAddress,
      timestamp: Date.now()
    };

    const txRecord = {
      id: 'tx_d_' + Date.now(),
      type: 'DEPOSIT',
      title: 'Tonkeeper GRAM Deposit',
      txHash: cleanHash,
      sender: senderAddress,
      destination: 'UQDFaBOdgZhLBZRSG28qImvn-Gn4kZ0D0HQVEHCtS9fFu7P0',
      amount: `+${gram.toFixed(2)} GRAM`,
      isPositive: true,
      status: 'Completed',
      timestamp: Date.now()
    };

    if (!rawUser.transactions_history) rawUser.transactions_history = [];
    rawUser.transactions_history.unshift(txRecord);

    if (pool) {
      pool.query(
        `INSERT INTO processed_tx_hashes (tx_hash, user_id, amount, processed_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tx_hash) DO NOTHING`,
        [cleanHash, id, gram, Date.now()]
      ).catch(e => console.error('Error persisting processed hash to Neon:', e.message));

      pool.query(
        `INSERT INTO transactions (id, user_id, type, title, tx_hash, sender, destination, amount, is_positive, status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [txRecord.id, id, txRecord.type, txRecord.title, txRecord.txHash, txRecord.sender, txRecord.destination, txRecord.amount, txRecord.isPositive, txRecord.status, txRecord.timestamp]
      ).catch(e => console.error('Error persisting transaction to Neon:', e.message));
    }

    this.save();
    return {
      success: true,
      message: `Successfully deposited +${gram.toFixed(2)} GRAM! Added to Deposit Balance (Ready for rig activation).`,
      amount: gram,
      txHash: cleanHash,
      user: this.getUser(userId)
    };
  }

  bindWallet(userId, walletAddress, walletName = 'Tonkeeper') {
    const id = String(userId);
    this.getUser(id);
    const rawUser = this.data.users[id];

    rawUser.ton_wallet_address = walletAddress;
    rawUser.ton_wallet_type = walletName;

    if (!rawUser.completed_tasks['connect_tonkeeper']) {
      rawUser.completed_tasks['connect_tonkeeper'] = Date.now();
      rawUser.gram_balance = Number(((rawUser.gram_balance || 0) + 0.10).toFixed(4));

      if (pool) {
        pool.query(
          `INSERT INTO completed_tasks (user_id, task_id, completed_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, task_id) DO NOTHING`,
          [id, 'connect_tonkeeper', Date.now()]
        ).catch(e => console.error('Error persisting task to Neon:', e.message));
      }
    }

    this.save();
    return {
      success: true,
      message: `Connected ${walletName} (${walletAddress.substring(0, 4)}...${walletAddress.slice(-4)})`,
      user: this.getUser(userId)
    };
  }

  disconnectWallet(userId) {
    const id = String(userId);
    this.getUser(id);
    const rawUser = this.data.users[id];

    rawUser.ton_wallet_address = null;
    rawUser.ton_wallet_type = null;
    this.save();
    return {
      success: true,
      message: 'Wallet disconnected',
      user: this.getUser(userId)
    };
  }

  completeTask(userId, taskId) {
    const task = TASKS_CATALOG.find(t => t.id === taskId);
    if (!task) return { success: false, message: 'Task not found' };

    const id = String(userId);
    this.getUser(id);
    const rawUser = this.data.users[id];

    if (task.requiredInvites) {
      const refCount = rawUser.referrals_count || 0;
      if (refCount < task.requiredInvites) {
        return { 
          success: false, 
          message: `You have invited ${refCount}/${task.requiredInvites} friends. Invite ${task.requiredInvites - refCount} more friends to claim this reward!` 
        };
      }
    }

    if (rawUser.completed_tasks[taskId]) {
      if (task.category === 'daily') {
        const lastDone = rawUser.completed_tasks[taskId];
        const elapsed = Date.now() - lastDone;
        if (elapsed < 86400 * 1000) {
          const remainingMs = 86400 * 1000 - elapsed;
          const hours = Math.floor(remainingMs / (3600 * 1000));
          const mins = Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000));
          const secs = Math.floor((remainingMs % (60 * 1000)) / 1000);
          return { 
            success: false, 
            message: `Daily bonus already claimed. Available again in ${hours}h ${mins}m ${secs}s!` 
          };
        }
      } else {
        return { success: false, message: 'Task already completed' };
      }
    }

    rawUser.completed_tasks[taskId] = Date.now();
    const isTon = task.rewardCurrency === 'TON';
    const amountVal = task.rewardAmount || (isTon ? (task.rewardTon || 1.0) : (task.rewardGram || 0.01));
    const rewardFormatted = isTon ? `+${amountVal.toFixed(2)} TON` : `+${amountVal.toFixed(2)} GRAM`;

    if (isTon) {
      rawUser.ton_balance = Number(((rawUser.ton_balance || 0) + amountVal).toFixed(4));
    } else {
      rawUser.gram_balance = Number(((rawUser.gram_balance || 0) + amountVal).toFixed(4));
    }

    const txRecord = {
      id: 'tx_t_' + Date.now(),
      type: 'TASK',
      title: task.title,
      amount: rewardFormatted,
      isPositive: true,
      status: 'Completed',
      timestamp: Date.now()
    };

    if (!rawUser.transactions_history) rawUser.transactions_history = [];
    rawUser.transactions_history.unshift(txRecord);

    if (pool) {
      pool.query(
        `INSERT INTO completed_tasks (user_id, task_id, completed_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, task_id) DO UPDATE SET completed_at = EXCLUDED.completed_at`,
        [id, taskId, Date.now()]
      ).catch(e => console.error('Error persisting completed task to Neon:', e.message));

      pool.query(
        `INSERT INTO transactions (id, user_id, type, title, amount, is_positive, status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [txRecord.id, id, txRecord.type, txRecord.title, txRecord.amount, txRecord.isPositive, txRecord.status, txRecord.timestamp]
      ).catch(e => console.error('Error persisting transaction to Neon:', e.message));
    }

    this.save();

    return {
      success: true,
      rewardText: rewardFormatted,
      rewardTon: isTon ? amountVal : 0,
      rewardGram: !isTon ? amountVal : 0,
      message: `Task completed! Received ${rewardFormatted}`,
      user: this.getUser(userId)
    };
  }

  // Bind Referral (Adds +1 Mystery Box to inviter, sets 10% lifetime mining commission)
  bindReferrer(userId, rawRefCode) {
    if (!rawRefCode || !userId) return { success: false, message: 'Invalid arguments' };

    const id = String(userId).trim();
    this.getUser(id);
    const rawUser = this.data.users[id];
    if (!rawUser) return { success: false, message: 'User not found' };

    // If user is already bound to a referrer, do not allow overriding
    if (rawUser.referred_by) {
      return { success: false, message: 'User is already referred by ' + rawUser.referred_by };
    }

    // Clean and normalize referral code
    let code = String(rawRefCode).trim();
    if (code.toLowerCase().startsWith('ref_')) {
      code = code.substring(4).trim();
    } else if (code.toLowerCase().startsWith('ref-')) {
      code = code.substring(4).trim();
    } else if (code.toLowerCase().startsWith('ref')) {
      code = code.substring(3).trim();
    }

    if (!code) return { success: false, message: 'Empty referral code' };

    // Prevent self-referral
    if (code === id || (rawUser.referral_code && code.toUpperCase() === rawUser.referral_code.toUpperCase())) {
      return { success: false, message: 'Cannot refer yourself' };
    }

    // Find referrer in loaded users
    let referrerId = null;
    let referrer = null;

    // 1. Match by referral_code (case-insensitive)
    for (const [rId, u] of Object.entries(this.data.users)) {
      if (rId === id) continue;
      if (u.referral_code && u.referral_code.toUpperCase() === code.toUpperCase()) {
        referrerId = rId;
        referrer = u;
        break;
      }
    }

    // 2. Match by user ID directly (e.g. Telegram ID)
    if (!referrerId) {
      for (const [rId, u] of Object.entries(this.data.users)) {
        if (rId === id) continue;
        if (rId === code || String(rId) === code) {
          referrerId = rId;
          referrer = u;
          break;
        }
      }
    }

    if (!referrerId || !referrer) {
      return { success: false, message: 'Referral code not found' };
    }

    // Bind referrer
    rawUser.referred_by = referrerId;
    referrer.referrals_count = (parseInt(referrer.referrals_count) || 0) + 1;
    referrer.mystery_boxes_available = (parseInt(referrer.mystery_boxes_available) || 0) + 1;

    // Save changes to database and local store
    this.save();

    console.log(`✅ [Referral Tracked] User ${id} referred by ${referrerId} (${referrer.username || referrer.first_name}). Referrer total refs: ${referrer.referrals_count}, Mystery Boxes: ${referrer.mystery_boxes_available}`);

    return {
      success: true,
      referrerId: referrerId,
      referrer: this.getUser(referrerId),
      user: this.getUser(id),
      message: 'Referral linked successfully'
    };
  }

  // =========================================================================
  // GIFT CODES MANAGEMENT & CLAIM ENGINE
  // =========================================================================

  createGiftCode({ code, rewardGram, maxClaims = 100, expiresAt = null }) {
    if (!this.data.gift_codes) this.data.gift_codes = {};

    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return { success: false, message: 'Gift Code name is required' };

    const reward = parseFloat(rewardGram);
    if (isNaN(reward) || reward <= 0) {
      return { success: false, message: 'Reward amount must be greater than 0 GRAM' };
    }

    const limit = Math.max(1, parseInt(maxClaims) || 100);

    for (const gc of Object.values(this.data.gift_codes)) {
      if (gc.code && gc.code.toUpperCase() === cleanCode) {
        return { success: false, message: `Gift Code "${cleanCode}" already exists! Choose another name.` };
      }
    }

    const newCodeObj = {
      id: 'gc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      code: cleanCode,
      rewardGram: reward,
      maxClaims: limit,
      claimedCount: 0,
      claimedBy: {},
      isActive: true,
      createdAt: Date.now(),
      expiresAt: expiresAt ? parseInt(expiresAt) : null
    };

    this.data.gift_codes[newCodeObj.id] = newCodeObj;

    if (pool) {
      pool.query(
        `INSERT INTO gift_codes (id, code, reward_gram, max_claims, claimed_count, is_active, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newCodeObj.id, newCodeObj.code, newCodeObj.rewardGram, newCodeObj.maxClaims, 0, true, newCodeObj.createdAt, newCodeObj.expiresAt]
      ).catch(e => console.error('Error persisting gift code to Neon:', e.message));
    }

    this.save();

    return {
      success: true,
      message: `Gift Code "${cleanCode}" created successfully (+${reward.toFixed(2)} GRAM, Limit: ${limit} users)!`,
      giftCode: newCodeObj
    };
  }

  claimGiftCode(userId, inputCode) {
    const id = String(userId);
    this.getUser(id);
    const rawUser = this.data.users[id];
    if (!rawUser) return { success: false, message: 'User not found' };

    const cleanCode = String(inputCode || '').trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Please enter a valid Gift Code' };
    }

    if (!this.data.gift_codes) this.data.gift_codes = {};

    let targetCode = null;
    for (const gc of Object.values(this.data.gift_codes)) {
      if (gc.code && gc.code.toUpperCase() === cleanCode) {
        targetCode = gc;
        break;
      }
    }

    if (!targetCode) {
      return { success: false, message: 'Invalid Gift Code! Please check and try again.' };
    }

    if (targetCode.isActive === false) {
      return { success: false, message: 'This Gift Code has been deactivated.' };
    }

    if (targetCode.expiresAt && targetCode.expiresAt < Date.now()) {
      return { success: false, message: 'This Gift Code has expired.' };
    }

    if (!targetCode.claimedBy) targetCode.claimedBy = {};

    if (targetCode.claimedBy[id]) {
      return { success: false, message: 'You have already claimed this Gift Code!' };
    }

    if (targetCode.maxClaims > 0 && (targetCode.claimedCount || 0) >= targetCode.maxClaims) {
      return { success: false, message: `This Gift Code has reached its maximum claim limit (${targetCode.maxClaims} users).` };
    }

    // Award GRAM tokens
    const reward = Number(targetCode.rewardGram || 0);
    rawUser.gram_balance = Number(((rawUser.gram_balance || 0) + reward).toFixed(4));

    // Update code claims count
    targetCode.claimedCount = (targetCode.claimedCount || 0) + 1;
    targetCode.claimedBy[id] = Date.now();

    const claimRecordId = 'claim_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const txRecord = {
      id: 'tx_gc_' + Date.now(),
      type: 'GIFT_CODE',
      title: `Gift Code Claimed (${targetCode.code})`,
      amount: `+${reward.toFixed(2)} GRAM`,
      isPositive: true,
      status: 'Completed',
      timestamp: Date.now()
    };

    if (!rawUser.transactions_history) rawUser.transactions_history = [];
    rawUser.transactions_history.unshift(txRecord);

    if (pool) {
      pool.query(
        `UPDATE gift_codes SET claimed_count = claimed_count + 1 WHERE id = $1`,
        [targetCode.id]
      ).catch(e => console.error('Error updating gift code in Neon:', e.message));

      pool.query(
        `INSERT INTO gift_code_claims (id, code_id, code, user_id, reward_gram, claimed_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code_id, user_id) DO NOTHING`,
        [claimRecordId, targetCode.id, targetCode.code, id, reward, Date.now()]
      ).catch(e => console.error('Error inserting gift code claim to Neon:', e.message));

      pool.query(
        `INSERT INTO transactions (id, user_id, type, title, amount, is_positive, status, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [txRecord.id, id, txRecord.type, txRecord.title, txRecord.amount, txRecord.isPositive, txRecord.status, txRecord.timestamp]
      ).catch(e => console.error('Error persisting transaction to Neon:', e.message));
    }

    this.save();

    return {
      success: true,
      code: targetCode.code,
      rewardGram: reward,
      message: `🎉 Gift Box Claimed! Received +${reward.toFixed(2)} GRAM tokens.`,
      user: this.getUser(id)
    };
  }

  getGiftCodes() {
    if (!this.data.gift_codes) this.data.gift_codes = {};
    return Object.values(this.data.gift_codes).map(gc => ({
      id: gc.id,
      code: gc.code,
      rewardGram: parseFloat(gc.rewardGram || gc.reward_gram || 0),
      reward_gram: parseFloat(gc.rewardGram || gc.reward_gram || 0),
      maxClaims: parseInt(gc.maxClaims || gc.max_claims || 1),
      max_claims: parseInt(gc.maxClaims || gc.max_claims || 1),
      claimedCount: parseInt(gc.claimedCount || gc.claims_count || gc.claimed_count || 0),
      claims_count: parseInt(gc.claimedCount || gc.claims_count || gc.claimed_count || 0),
      isActive: gc.isActive !== false && gc.is_active !== false,
      is_active: gc.isActive !== false && gc.is_active !== false,
      createdAt: parseInt(gc.createdAt || gc.created_at || Date.now()),
      created_at: parseInt(gc.createdAt || gc.created_at || Date.now()),
      expiresAt: gc.expiresAt || gc.expires_at || null,
      expires_at: gc.expiresAt || gc.expires_at || null,
      claimedBy: gc.claimedBy || {}
    })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  deleteGiftCode(codeId) {
    if (!this.data.gift_codes || !this.data.gift_codes[codeId]) {
      return { success: false, message: 'Gift code not found' };
    }

    delete this.data.gift_codes[codeId];

    if (pool) {
      pool.query('DELETE FROM gift_codes WHERE id = $1', [codeId])
        .catch(e => console.error('Error deleting gift code in Neon:', e.message));
      pool.query('DELETE FROM gift_code_claims WHERE code_id = $1', [codeId])
        .catch(e => console.error('Error deleting gift code claims in Neon:', e.message));
    }

    this.save();
    return { success: true, message: 'Gift code deleted successfully' };
  }

  toggleGiftCode(codeId, isActive) {
    if (!this.data.gift_codes || !this.data.gift_codes[codeId]) {
      return { success: false, message: 'Gift code not found' };
    }

    const gc = this.data.gift_codes[codeId];
    gc.isActive = isActive !== undefined ? isActive : !gc.isActive;

    if (pool) {
      pool.query('UPDATE gift_codes SET is_active = $1 WHERE id = $2', [gc.isActive, codeId])
        .catch(e => console.error('Error updating gift code in Neon:', e.message));
    }

    this.save();
    return {
      success: true,
      message: `Gift code is now ${gc.isActive ? 'Active' : 'Inactive'}`,
      giftCode: gc
    };
  }

  // =========================================================================
  // WITHDRAWALS & DEPOSITS MANAGEMENT ENGINE (FOR ADMIN & ON-CHAIN EXPLORER)
  // =========================================================================

  getWithdrawals() {
    if (!this.data.withdrawals) this.data.withdrawals = {};
    const users = this.data.users || {};

    return Object.values(this.data.withdrawals).map(wd => {
      const u = users[String(wd.userId || wd.user_id)] || {};
      const txHash = wd.txHash || wd.tx_hash || null;
      return {
        id: wd.id,
        userId: wd.userId || wd.user_id,
        user_id: wd.userId || wd.user_id,
        userName: u.first_name || u.username || 'Miner',
        userUsername: u.username || '',
        userAvatar: u.photo_url || null,
        userWallet: u.ton_wallet_address || null,
        amount: parseFloat(wd.amount || 0),
        destination: wd.destination || u.ton_wallet_address || 'Unknown Wallet',
        status: (wd.status || 'PENDING').toUpperCase(),
        txHash: txHash,
        tx_hash: txHash,
        explorerUrl: txHash ? `https://tonviewer.com/transaction/${encodeURIComponent(txHash)}` : null,
        tonscanUrl: txHash ? `https://tonscan.org/tx/${encodeURIComponent(txHash)}` : null,
        createdAt: parseInt(wd.createdAt || wd.created_at || Date.now()),
        created_at: parseInt(wd.createdAt || wd.created_at || Date.now()),
        processedAt: wd.processedAt || wd.processed_at || null,
        processed_at: wd.processedAt || wd.processed_at || null,
        note: wd.note || ''
      };
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  approveWithdrawal(withdrawalId, txHash = '', note = '') {
    if (!this.data.withdrawals || !this.data.withdrawals[withdrawalId]) {
      return { success: false, message: 'Withdrawal record not found' };
    }

    const wd = this.data.withdrawals[withdrawalId];
    if (wd.status === 'COMPLETED' || wd.status === 'APPROVED') {
      return { success: false, message: 'Withdrawal is already marked as Completed!' };
    }

    const cleanTxHash = txHash ? String(txHash).trim() : '';
    wd.status = 'COMPLETED';
    wd.txHash = cleanTxHash || null;
    wd.tx_hash = cleanTxHash || null;
    wd.processedAt = Date.now();
    wd.processed_at = Date.now();
    if (note) wd.note = note;

    const rawUser = this.data.users[String(wd.userId || wd.user_id)];
    if (rawUser) {
      // Record completed withdrawal in user metrics
      rawUser.total_withdrawn = Number(((rawUser.total_withdrawn || 0) + wd.amount).toFixed(4));

      // Update corresponding transaction in user history
      if (rawUser.transactions_history) {
        const matchTx = rawUser.transactions_history.find(t => t.withdrawalId === withdrawalId || (t.type === 'WITHDRAW' && t.status === 'PENDING'));
        if (matchTx) {
          matchTx.status = 'Completed';
          if (cleanTxHash) matchTx.txHash = cleanTxHash;
        }
      }
    }

    if (pool) {
      pool.query(
        `UPDATE withdrawals SET status = 'COMPLETED', tx_hash = $1, processed_at = $2, note = $3 WHERE id = $4`,
        [cleanTxHash || null, Date.now(), note || null, withdrawalId]
      ).catch(e => console.error('Error updating withdrawal in Neon:', e.message));

      pool.query(
        `UPDATE transactions SET status = 'Completed', tx_hash = $1 WHERE user_id = $2 AND type = 'WITHDRAW' AND status = 'PENDING'`,
        [cleanTxHash || null, String(wd.userId || wd.user_id)]
      ).catch(e => console.error('Error updating transaction in Neon:', e.message));
    }

    this.save();
    return {
      success: true,
      message: `Withdrawal #${withdrawalId} of ${wd.amount} GRAM marked as Completed!`,
      withdrawal: wd
    };
  }

  rejectWithdrawal(withdrawalId, reason = '') {
    if (!this.data.withdrawals || !this.data.withdrawals[withdrawalId]) {
      return { success: false, message: 'Withdrawal record not found' };
    }

    const wd = this.data.withdrawals[withdrawalId];
    if (wd.status === 'REJECTED') {
      return { success: false, message: 'Withdrawal is already Rejected and refunded!' };
    }

    if (wd.status === 'COMPLETED' || wd.status === 'APPROVED') {
      return { success: false, message: 'Cannot reject a completed withdrawal!' };
    }

    wd.status = 'REJECTED';
    wd.processedAt = Date.now();
    wd.processed_at = Date.now();
    wd.note = reason || 'Rejected by Admin';

    const rawUser = this.data.users[String(wd.userId || wd.user_id)];
    if (rawUser) {
      // Refund the amount back to user's gram_balance
      rawUser.gram_balance = Number(((rawUser.gram_balance || 0) + wd.amount).toFixed(4));

      // Update corresponding transaction in transactions_history
      if (rawUser.transactions_history) {
        const matchTx = rawUser.transactions_history.find(t => t.withdrawalId === withdrawalId || (t.type === 'WITHDRAW' && t.status === 'PENDING'));
        if (matchTx) {
          matchTx.status = 'Rejected';
          matchTx.title = `Withdrawal Rejected (${reason || 'Refunded'})`;
        }
      }
    }

    if (pool) {
      pool.query(
        `UPDATE withdrawals SET status = 'REJECTED', processed_at = $1, note = $2 WHERE id = $3`,
        [Date.now(), reason || 'Rejected by Admin', withdrawalId]
      ).catch(e => console.error('Error updating rejected withdrawal in Neon:', e.message));

      pool.query(
        `UPDATE transactions SET status = 'Rejected' WHERE user_id = $1 AND type = 'WITHDRAW' AND status = 'PENDING'`,
        [String(wd.userId || wd.user_id)]
      ).catch(e => console.error('Error updating transaction in Neon:', e.message));
    }

    this.save();
    return {
      success: true,
      message: `Withdrawal #${withdrawalId} rejected. +${wd.amount} GRAM refunded to user #${wd.userId || wd.user_id}'s balance.`,
      withdrawal: wd
    };
  }

  getDeposits() {
    const users = this.data.users || {};
    const deposits = [];

    for (const [uId, u] of Object.entries(users)) {
      const txHistory = u.transactions_history || [];
      for (const tx of txHistory) {
        if (tx.type === 'DEPOSIT') {
          const txHash = tx.txHash || tx.tx_hash || '';
          deposits.push({
            id: tx.id,
            userId: uId,
            user_id: uId,
            userName: u.first_name || u.username || 'Miner',
            userUsername: u.username || '',
            userAvatar: u.photo_url || null,
            userWallet: u.ton_wallet_address || null,
            amount: tx.amount || '',
            amountGram: parseFloat((tx.amount || '0').replace(/[^0-9.]/g, '')) || 0,
            sender: tx.sender || u.ton_wallet_address || 'Tonkeeper Wallet',
            destination: tx.destination || 'UQDFaBOdgZhLBZRSG28qImvn-Gn4kZ0D0HQVEHCtS9fFu7P0',
            txHash: txHash,
            tx_hash: txHash,
            explorerUrl: txHash ? `https://tonviewer.com/transaction/${encodeURIComponent(txHash)}` : null,
            tonscanUrl: txHash ? `https://tonscan.org/tx/${encodeURIComponent(txHash)}` : null,
            status: tx.status || 'Completed',
            timestamp: parseInt(tx.timestamp) || Date.now()
          });
        }
      }
    }

    deposits.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return deposits;
  }

  // Ban User
  banUser(userId, reason = 'Banned by Admin') {
    const id = String(userId).trim();
    this.getUser(id);
    const rawUser = this.data.users[id];
    if (!rawUser) return { success: false, message: 'User not found' };

    rawUser.is_banned = true;
    rawUser.ban_reason = reason || 'Banned by Admin';
    rawUser.banned_at = Date.now();

    if (pool) {
      pool.query(
        `UPDATE users SET is_banned = TRUE, ban_reason = $1, banned_at = $2 WHERE id = $3`,
        [rawUser.ban_reason, rawUser.banned_at, id]
      ).catch(e => console.error('Error updating ban status in Neon:', e.message));
    }

    this.save();
    return {
      success: true,
      message: `User ${id} has been banned.`,
      user: this.getUser(id)
    };
  }

  // Unban User
  unbanUser(userId) {
    const id = String(userId).trim();
    this.getUser(id);
    const rawUser = this.data.users[id];
    if (!rawUser) return { success: false, message: 'User not found' };

    rawUser.is_banned = false;
    rawUser.ban_reason = '';
    rawUser.banned_at = null;

    if (pool) {
      pool.query(
        `UPDATE users SET is_banned = FALSE, ban_reason = '', banned_at = NULL WHERE id = $3`,
        ['', null, id]
      ).catch(e => console.error('Error updating unban status in Neon:', e.message));
    }

    this.save();
    return {
      success: true,
      message: `User ${id} has been unbanned.`,
      user: this.getUser(id)
    };
  }

  // Register an Admin Telegram Chat ID for Alert Bot notifications
  registerAdminChat(chatId, username = '', firstName = '') {
    const id = String(chatId).trim();
    if (!id) return;
    if (!this.data.admin_chats) this.data.admin_chats = {};
    this.data.admin_chats[id] = {
      chatId: id,
      username: username || '',
      firstName: firstName || '',
      registeredAt: Date.now()
    };

    if (pool) {
      pool.query(
        `INSERT INTO admin_chats (chat_id, username, first_name, registered_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (chat_id) DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name`,
        [id, username || '', firstName || '', Date.now()]
      ).catch(e => console.error('Error persisting admin chat to Neon:', e.message));
    }

    this.save();
  }

  // Retrieve all registered Admin Chat IDs (from DB, memory, and env)
  getAdminChatIds() {
    if (!this.data.admin_chats) this.data.admin_chats = {};
    const ids = new Set(Object.keys(this.data.admin_chats));
    if (process.env.ADMIN_TELEGRAM_ID) {
      ids.add(String(process.env.ADMIN_TELEGRAM_ID).trim());
    }
    ids.add('8829204942'); // Master admin Dark Duo
    return Array.from(ids).filter(Boolean);
  }
}

export const db = new Database();
export { pool };
