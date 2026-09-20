import express from 'express';
import { db, MINING_PLANS } from '../db.js';
import { 
  getBot, 
  notifyWithdrawalApproved, 
  notifyWithdrawalRejected, 
  notifyPlanActivated, 
  notifyAdminBalanceAdjusted 
} from '../bot.js';

const router = express.Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET || '3845';

// Auth middleware for admin API
function requireAdminAuth(req, res, next) {
  const secretHeader = req.headers['x-admin-secret'] || req.query.secret;
  if (!secretHeader || secretHeader !== ADMIN_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Invalid Admin Secret' });
  }
  next();
}

// 1. Verify Admin Auth
router.post('/login', (req, res) => {
  const { secret } = req.body;
  if (secret === ADMIN_SECRET) {
    return res.json({ success: true, message: 'Authentication successful' });
  }
  return res.status(401).json({ success: false, message: 'Invalid Admin PIN/Secret' });
});

// 2. Comprehensive Admin Statistics
router.get('/stats', requireAdminAuth, (req, res) => {
  try {
    const users = Object.values(db.data.users || {});
    const now = Date.now();

    let totalUsers = users.length;
    let totalGramBalance = 0;
    let totalDepositBalance = 0;
    let totalMined = 0;
    let totalDeposited = 0;
    let totalWithdrawn = 0;
    let totalActiveRigs = 0;
    let totalNetworkHashrate = 0;
    let totalReferrals = 0;
    let totalMysteryBoxesOpened = 0;

    const tierBreakdown = {
      starter_miner_1ton: { name: 'Tier 1: Starter (1 GRAM)', count: 0, hashrate: 0 },
      pro_farm_5ton: { name: 'Tier 2: Pro Rig (5 GRAM)', count: 0, hashrate: 0 },
      asic_turbo_10ton: { name: 'Tier 3: ASIC X9 (10 GRAM)', count: 0, hashrate: 0 },
      quantum_node_25ton: { name: 'Tier 4: Quantum (25 GRAM)', count: 0, hashrate: 0 }
    };

    users.forEach(u => {
      totalGramBalance += Number(u.gram_balance || 0);
      totalDepositBalance += Number(u.deposit_balance || 0);
      totalMined += Number(u.total_mined || 0);
      totalDeposited += Number(u.total_deposited || 0);
      totalWithdrawn += Number(u.total_withdrawn || 0);
      totalReferrals += Number(u.referrals_count || 0);
      totalMysteryBoxesOpened += (u.opened_boxes_history || []).length;

      (u.active_plans || []).forEach(p => {
        if (!p.expires_at || p.expires_at > now) {
          totalActiveRigs++;
          totalNetworkHashrate += Number(p.hashrate || 0);
          if (tierBreakdown[p.plan_id]) {
            tierBreakdown[p.plan_id].count++;
            tierBreakdown[p.plan_id].hashrate += Number(p.hashrate || 0);
          }
        }
      });
    });

    const allTransactions = [];
    users.forEach(u => {
      (u.transactions_history || []).forEach(tx => {
        allTransactions.push({ ...tx, userId: u.id, userName: u.first_name || u.username || u.id });
      });
    });

    const withdrawalsList = db.getWithdrawals();
    const depositsList = db.getDeposits();

    const pendingWithdrawals = withdrawalsList.filter(w => w.status === 'PENDING');
    const totalPendingWithdrawalsCount = pendingWithdrawals.length;
    const totalPendingWithdrawalsAmount = pendingWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

    const completedWithdrawals = withdrawalsList.filter(w => w.status === 'COMPLETED' || w.status === 'APPROVED');
    const totalCompletedWithdrawalsCount = completedWithdrawals.length;
    const totalCompletedWithdrawalsAmount = completedWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalGramBalance: Number(totalGramBalance.toFixed(2)),
        totalDepositBalance: Number(totalDepositBalance.toFixed(2)),
        totalMined: Number(totalMined.toFixed(4)),
        totalDeposited: Number(totalDeposited.toFixed(2)),
        totalWithdrawn: Number(totalWithdrawn.toFixed(2)),
        netDepositPool: Number((totalDeposited - totalWithdrawn).toFixed(2)),
        totalActiveRigs,
        totalNetworkHashrate: Number(totalNetworkHashrate.toFixed(1)),
        totalReferrals,
        totalMysteryBoxesOpened,
        totalTransactionsCount: allTransactions.length,
        totalDepositsCount: depositsList.length,
        totalPendingWithdrawalsCount,
        totalPendingWithdrawalsAmount: Number(totalPendingWithdrawalsAmount.toFixed(2)),
        totalCompletedWithdrawalsCount,
        totalCompletedWithdrawalsAmount: Number(totalCompletedWithdrawalsAmount.toFixed(2)),
        tierBreakdown,
        serverTime: now,
        dbConnected: true
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get All Users (with mining stats calculated)
router.get('/users', requireAdminAuth, (req, res) => {
  try {
    const rawUsers = db.data.users || {};
    const usersList = Object.keys(rawUsers).map(id => {
      const u = db.getUser(id);
      return {
        id: u.id,
        first_name: u.first_name,
        username: u.username,
        photo_url: u.photo_url,
        ton_wallet_address: u.ton_wallet_address,
        ton_wallet_type: u.ton_wallet_type,
        gram_balance: Number(u.gram_balance.toFixed(2)),
        deposit_balance: Number((u.deposit_balance || 0).toFixed(2)),
        total_mined: Number(u.total_mined.toFixed(4)),
        unclaimed_gram: Number(u.unclaimed_gram.toFixed(4)),
        current_hashrate: u.current_hashrate,
        daily_yield_gram: u.daily_yield_gram,
        total_deposited: Number((u.total_deposited || 0).toFixed(2)),
        total_withdrawn: Number((u.total_withdrawn || 0).toFixed(2)),
        active_plans_count: (u.active_plans || []).length,
        mystery_boxes_available: u.mystery_boxes_available || 0,
        referrals_count: u.referrals_count || 0,
        referred_by: u.referred_by || null,
        referral_earnings: Number((u.referral_earnings || 0).toFixed(4)),
        streak_count: u.streak_count || 1,
        referral_code: u.referral_code,
        created_at: u.created_at || Date.now()
      };
    });

    usersList.sort((a, b) => (b.gram_balance + (b.deposit_balance || 0) + b.total_deposited) - (a.gram_balance + (a.deposit_balance || 0) + a.total_deposited));

    return res.json({ success: true, users: usersList });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get User Details
router.get('/user/:id', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const user = db.getUser(id);
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Adjust User Balance (Add or Deduct)
router.post('/user/balance', requireAdminAuth, (req, res) => {
  try {
    const { userId, amount, type, balanceType = 'available', note } = req.body;
    if (!userId || amount === undefined || isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'Valid userId and amount required' });
    }

    const numAmount = Math.abs(Number(amount));
    const rawUser = db.data.users[String(userId)];
    if (!rawUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isAddition = type !== 'deduct';
    const isDepositBal = balanceType === 'deposit';
    const currentTargetBal = isDepositBal ? (rawUser.deposit_balance || 0) : (rawUser.gram_balance || 0);

    if (!isAddition && currentTargetBal < numAmount) {
      return res.status(400).json({ success: false, message: `User does not have enough ${isDepositBal ? 'Deposit' : 'Available'} GRAM to deduct` });
    }

    if (isDepositBal) {
      if (isAddition) {
        rawUser.deposit_balance = Number(((rawUser.deposit_balance || 0) + numAmount).toFixed(4));
      } else {
        rawUser.deposit_balance = Number(((rawUser.deposit_balance || 0) - numAmount).toFixed(4));
      }
    } else {
      if (isAddition) {
        rawUser.gram_balance = Number(((rawUser.gram_balance || 0) + numAmount).toFixed(4));
      } else {
        rawUser.gram_balance = Number(((rawUser.gram_balance || 0) - numAmount).toFixed(4));
      }
    }

    const txRecord = {
      id: 'tx_adm_' + Date.now(),
      type: isAddition ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
      title: note || (isAddition ? `Admin ${isDepositBal ? 'Deposit' : 'Bonus'} Credit` : 'Admin Balance Adjustment'),
      amount: `${isAddition ? '+' : '-'}${numAmount.toFixed(2)} ${isDepositBal ? 'Deposit GRAM' : 'GRAM'}`,
      isPositive: isAddition,
      status: 'Completed',
      timestamp: Date.now()
    };

    if (!rawUser.transactions_history) rawUser.transactions_history = [];
    rawUser.transactions_history.unshift(txRecord);

    db.save();

    // Send Telegram alert if addition
    if (isAddition) {
      notifyAdminBalanceAdjusted(userId, {
        amount: numAmount,
        isAddition: true,
        balanceType: balanceType,
        note: note,
        newBalance: isDepositBal ? rawUser.deposit_balance : rawUser.gram_balance
      }).catch(() => {});
    }

    return res.json({
      success: true,
      message: `Successfully ${isAddition ? 'added' : 'deducted'} ${numAmount.toFixed(2)} GRAM (${isDepositBal ? 'Deposit Balance' : 'Available Balance'}). Available: ${(rawUser.gram_balance || 0).toFixed(2)} GRAM, Deposit: ${(rawUser.deposit_balance || 0).toFixed(2)} GRAM`,
      user: db.getUser(userId)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Gift Mining Rig / Plan to User
router.post('/user/gift-plan', requireAdminAuth, (req, res) => {
  try {
    const { userId, planId } = req.body;
    const plan = MINING_PLANS.find(p => p.id === planId);
    if (!plan) return res.status(400).json({ success: false, message: 'Invalid plan selected' });

    const rawUser = db.data.users[String(userId)];
    if (!rawUser) return res.status(404).json({ success: false, message: 'User not found' });

    const expiresAt = Date.now() + plan.durationDays * 86400 * 1000;

    rawUser.active_plans.push({
      plan_id: plan.id,
      plan_name: plan.name,
      activated_at: Date.now(),
      expires_at: expiresAt,
      hashrate: plan.hashrate,
      dailyProfit: plan.dailyProfit,
      paid_currency: 'ADMIN_GIFT'
    });

    rawUser.transactions_history.unshift({
      id: 'tx_gift_' + Date.now(),
      type: 'ADMIN_GIFT',
      title: `Admin Gifted: ${plan.name}`,
      amount: `+${plan.hashrate} GH/s`,
      isPositive: true,
      status: 'Completed',
      timestamp: Date.now()
    });

    db.save();

    // Notify user via Telegram
    notifyPlanActivated(userId, {
      plan,
      expiresAt,
      isGift: true
    }).catch(() => {});

    return res.json({
      success: true,
      message: `Gifted ${plan.name} (+${plan.hashrate} GH/s) to user ${userId}!`,
      user: db.getUser(userId)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Gift Mystery Box to User or All Users
router.post('/user/gift-box', requireAdminAuth, (req, res) => {
  try {
    const { userId, count = 1, toAll = false } = req.body;
    const numBoxes = Math.max(1, parseInt(count) || 1);

    if (toAll) {
      Object.values(db.data.users).forEach(u => {
        u.mystery_boxes_available = (u.mystery_boxes_available || 0) + numBoxes;
      });
      db.save();
      return res.json({
        success: true,
        message: `Successfully gifted +${numBoxes} Mystery Box(es) to ALL ${Object.keys(db.data.users).length} users!`
      });
    }

    const rawUser = db.data.users[String(userId)];
    if (!rawUser) return res.status(404).json({ success: false, message: 'User not found' });

    rawUser.mystery_boxes_available = (rawUser.mystery_boxes_available || 0) + numBoxes;
    db.save();

    return res.json({
      success: true,
      message: `Gifted +${numBoxes} Mystery Box(es) to user ${userId}! Total available: ${rawUser.mystery_boxes_available}`,
      user: db.getUser(userId)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7.1 Ban User
router.post('/user/ban', requireAdminAuth, (req, res) => {
  try {
    const { userId, reason } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });
    const result = db.banUser(userId, reason || 'Banned by Admin');
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 7.2 Unban User
router.post('/user/unban', requireAdminAuth, (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });
    const result = db.unbanUser(userId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Get All System Transactions (Global Feed)
router.get('/transactions', requireAdminAuth, (req, res) => {
  try {
    const users = Object.values(db.data.users || {});
    const allTxs = [];

    users.forEach(u => {
      (u.transactions_history || []).forEach(tx => {
        allTxs.push({
          ...tx,
          userId: u.id,
          userName: u.first_name || u.username || 'Miner',
          wallet: u.ton_wallet_address || null
        });
      });
    });

    allTxs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return res.json({
      success: true,
      transactions: allTxs.slice(0, 150)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Broadcast Announcement via Telegram Bot
router.post('/broadcast', requireAdminAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Broadcast message cannot be empty' });
    }

    const bot = getBot();
    if (!bot) {
      return res.status(503).json({ success: false, message: 'Telegram Bot is not active or token missing' });
    }

    const userIds = Object.keys(db.data.users).filter(id => /^\d+$/.test(id)); // only valid numeric telegram user IDs
    let sentCount = 0;
    let failedCount = 0;

    for (const id of userIds) {
      try {
        await bot.telegram.sendMessage(Number(id), message, { parse_mode: 'Markdown' });
        sentCount++;
      } catch (e) {
        failedCount++;
      }
    }

    return res.json({
      success: true,
      message: `Broadcast completed! Sent to ${sentCount} users (${failedCount} failed/blocked).`,
      sentCount,
      failedCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Force DB Sync
router.post('/sync-db', requireAdminAuth, async (req, res) => {
  try {
    await db.initPostgres();
    return res.json({
      success: true,
      message: `Neon PostgreSQL state refreshed successfully! Total Users: ${Object.keys(db.data.users).length}`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Gift Codes Management (Create, List, Toggle, Delete)
router.get('/gift-codes', requireAdminAuth, (req, res) => {
  try {
    const giftCodes = db.getGiftCodes();
    return res.json({ success: true, giftCodes });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/gift-codes/create', requireAdminAuth, (req, res) => {
  try {
    const { code, rewardGram, maxClaims, expiresAt } = req.body;
    const result = db.createGiftCode({ code, rewardGram, maxClaims, expiresAt });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/gift-codes/delete', requireAdminAuth, (req, res) => {
  try {
    const { codeId } = req.body;
    const result = db.deleteGiftCode(codeId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/gift-codes/toggle', requireAdminAuth, (req, res) => {
  try {
    const { codeId, isActive } = req.body;
    const result = db.toggleGiftCode(codeId, isActive);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Verified Deposits System (with TON Scan Blockchain Transaction Link)
router.get('/deposits', requireAdminAuth, (req, res) => {
  try {
    const deposits = db.getDeposits();
    return res.json({ success: true, deposits });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Withdrawals Management System (List, Approve/Complete, Reject/Refund)
router.get('/withdrawals', requireAdminAuth, (req, res) => {
  try {
    const withdrawals = db.getWithdrawals();
    return res.json({ success: true, withdrawals });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/withdrawals/approve', requireAdminAuth, (req, res) => {
  try {
    const { withdrawalId, txHash, note } = req.body;
    if (!withdrawalId) return res.status(400).json({ success: false, message: 'Withdrawal ID required' });
    const result = db.approveWithdrawal(withdrawalId, txHash, note);
    if (result.success && result.withdrawal) {
      notifyWithdrawalApproved(result.withdrawal.userId || result.withdrawal.user_id, {
        amount: result.withdrawal.amount,
        destination: result.withdrawal.destination,
        withdrawalId: result.withdrawal.id,
        txHash: result.withdrawal.txHash || result.withdrawal.tx_hash,
        note: result.withdrawal.note
      }).catch(() => {});
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/withdrawals/reject', requireAdminAuth, (req, res) => {
  try {
    const { withdrawalId, reason } = req.body;
    if (!withdrawalId) return res.status(400).json({ success: false, message: 'Withdrawal ID required' });
    const result = db.rejectWithdrawal(withdrawalId, reason);
    if (result.success && result.withdrawal) {
      notifyWithdrawalRejected(result.withdrawal.userId || result.withdrawal.user_id, {
        amount: result.withdrawal.amount,
        withdrawalId: result.withdrawal.id,
        reason: reason
      }).catch(() => {});
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
