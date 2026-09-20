import express from 'express';
import { db, MINING_PLANS, TASKS_CATALOG } from '../db.js';
import { 
  getBot, 
  notifyDepositSuccess, 
  notifyWithdrawalPending, 
  notifyPlanActivated,
  notifyReferralPending,
  notifyReferralConfirmed
} from '../bot.js';
import { sendAlertWithdrawalRequest, sendAlertDeposit, sendAlertPlanPurchase } from '../alertBot.js';
import { verifyTonkeeperDepositOnChain, OFFICIAL_VAULT_ADDRESS } from '../blockchain.js';

const router = express.Router();

// Get user profile & live mining stats
router.get('/user/:id', (req, res) => {
  try {
    const { id } = req.params;
    const user = db.getUser(id);
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Sync user profile from Telegram WebApp / Start
router.post('/user/sync', async (req, res) => {
  try {
    const { userId, first_name, username, photo_url, refCode } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });
    
    let resolvedPhoto = photo_url;

    // If photo is missing, attempt to fetch using bot instance
    if (!resolvedPhoto) {
      const bot = getBot();
      if (bot) {
        try {
          const photos = await bot.telegram.getUserProfilePhotos(Number(userId), 0, 1);
          if (photos && photos.total_count > 0 && photos.photos[0]?.length > 0) {
            const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
            const link = await bot.telegram.getFileLink(fileId);
            resolvedPhoto = link.href;
          }
        } catch (e) {
          // Profile photo could be private
        }
      }
    }

    const updatedUser = db.syncUser(userId, {
      first_name,
      username,
      photo_url: resolvedPhoto
    });

    // If referral code/payload provided, bind referrer
    if (refCode) {
      const bindResult = db.bindReferrer(userId, refCode);
      if (bindResult.success && bindResult.referrerId) {
        const newUserName = first_name || (username ? `@${username}` : 'A new miner');
        const newUserHandle = username ? `@${username}` : null;

        if (bindResult.isPending) {
          notifyReferralPending(bindResult.referrerId, {
            newUserName,
            newUserHandle,
            userId
          }).catch(() => {});
        } else {
          notifyReferralConfirmed(bindResult.referrerId, {
            newUserName,
            newUserHandle,
            userId,
            totalReferrals: bindResult.referrer?.referrals_count,
            totalBoxes: bindResult.referrer?.mystery_boxes_available
          }).catch(() => {});
        }
      }
    }

    return res.json({ success: true, user: db.getUser(userId) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Verify Telegram Channel Membership (@gramfarmaichannel & @GramfarmAimining)
router.post('/auth/verify-channels', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, verified: false, message: 'Telegram User ID is required' });
    }

    const cleanId = String(userId).trim();
    const bot = getBot();

    // Must be a valid numeric Telegram user ID
    if (!/^\d+$/.test(cleanId)) {
      return res.json({
        success: false,
        verified: false,
        message: 'Please open Gram Farm AI inside the official Telegram Bot (@gramframaibot) and join both channels to verify!'
      });
    }

    if (!bot) {
      return res.json({
        success: false,
        verified: false,
        message: 'Telegram verification service is initializing. Please try again shortly.'
      });
    }

    const channels = [
      { id: '@gramfarmaichannel', name: 'Gram Farm AI Channel', url: 'https://t.me/gramfarmaichannel', key: 'channel' },
      { id: '@GramfarmAimining', name: 'Gram Farm Mining Community', url: 'https://t.me/GramfarmAimining', key: 'community' }
    ];

    const validStatuses = ['member', 'administrator', 'creator', 'restricted'];
    const missingChannels = [];

    for (const ch of channels) {
      try {
        const member = await bot.telegram.getChatMember(ch.id, Number(cleanId));
        if (!member || !validStatuses.includes(member.status)) {
          missingChannels.push(ch);
        }
      } catch (err) {
        console.log(`⚠️ [Channel Check] ${ch.id} check for user ${cleanId}: ${err.message}`);
        missingChannels.push(ch);
      }
    }

    if (missingChannels.length > 0) {
      const channelNames = missingChannels.map(c => c.name).join(' & ');
      return res.json({
        success: false,
        verified: false,
        missing: missingChannels.map(c => c.key),
        message: `You must join ${channelNames} to unlock the dashboard!`
      });
    }

    // Both joined successfully!
    const verifyResult = db.setChannelsVerified(cleanId);

    // If this verification confirmed a pending referral, notify referrer immediately
    if (verifyResult.referralConfirmed && verifyResult.referrerId) {
      const user = db.getUser(cleanId);
      const referrer = verifyResult.referrer || db.getUser(verifyResult.referrerId);
      const newUserName = user.first_name || (user.username ? `@${user.username}` : 'Miner');
      const newUserHandle = user.username ? `@${user.username}` : null;

      notifyReferralConfirmed(verifyResult.referrerId, {
        newUserName,
        newUserHandle,
        userId: cleanId,
        totalReferrals: referrer.referrals_count,
        totalBoxes: referrer.mystery_boxes_available
      }).catch(err => console.error('⚠️ [Channel Verification] Could not notify referrer:', err.message));
    }

    return res.json({
      success: true,
      verified: true,
      referralConfirmed: verifyResult.referralConfirmed,
      message: 'Channel membership verified successfully!'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch user profile photo via bot API
router.get('/user-avatar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rawUser = db.data.users[String(id)];
    if (rawUser?.photo_url) {
      return res.json({ success: true, photo_url: rawUser.photo_url });
    }

    const bot = getBot();
    if (bot) {
      try {
        const photos = await bot.telegram.getUserProfilePhotos(Number(id), 0, 1);
        if (photos && photos.total_count > 0 && photos.photos[0]?.length > 0) {
          const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
          const link = await bot.telegram.getFileLink(fileId);
          if (rawUser) {
            rawUser.photo_url = link.href;
            db.save();
          }
          return res.json({ success: true, photo_url: link.href });
        }
      } catch (e) {}
    }

    return res.json({ success: false, photo_url: null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Claim accumulated mining reward
router.post('/mine/claim', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });

    const user = db.getUser(userId);
    if (user.is_banned) {
      return res.status(403).json({ success: false, message: `Your account is suspended: ${user.ban_reason || 'Banned by Admin'}` });
    }

    const result = db.claimMining(userId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// List all investment / mining plans
router.get('/plans', (req, res) => {
  return res.json({ success: true, plans: MINING_PLANS });
});

// Purchase / Upgrade a mining plan
router.post('/plans/buy', (req, res) => {
  try {
    const { userId, planId, currency } = req.body;
    if (!userId || !planId) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    const user = db.getUser(userId);
    if (user.is_banned) {
      return res.status(403).json({ success: false, message: `Your account is suspended: ${user.ban_reason || 'Banned by Admin'}` });
    }

    const result = db.buyPlan(userId, planId, currency || 'GRAM');
    if (result.success) {
      const plan = MINING_PLANS.find(p => p.id === planId);
      if (plan) {
        const expiresAt = Date.now() + (plan.durationDays || 30) * 86400 * 1000;
        const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || '179.65.221.12';
        notifyPlanActivated(userId, { plan, expiresAt }).catch(() => {});
        sendAlertPlanPurchase({ user: db.getUser(userId), plan, ip: clientIp }).catch(() => {});
      }
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get user tasks
router.get('/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const user = db.getUser(id);
    const now = Date.now();
    const tasks = TASKS_CATALOG.map(t => {
      const completedAt = user.completed_tasks ? user.completed_tasks[t.id] : null;
      let isDone = Boolean(completedAt);
      let nextAvailableAt = null;

      if (t.category === 'daily') {
        if (completedAt) {
          const elapsed = now - completedAt;
          if (elapsed < 86400 * 1000) {
            isDone = true;
            nextAvailableAt = completedAt + 86400 * 1000;
          } else {
            isDone = false; // 24h passed, ready to claim again!
          }
        }
      }

      return {
        ...t,
        completed: isDone,
        completedAt: completedAt,
        nextAvailableAt: nextAvailableAt
      };
    });
    return res.json({ success: true, tasks, user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Complete a task (with Telegram getChatMember verification for Telegram channel task)
router.post('/tasks/complete', async (req, res) => {
  try {
    const { userId, taskId } = req.body;
    if (!userId || !taskId) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    // Verify Telegram Channel Membership via getChatMember for join_tg_channel
    if (taskId === 'join_tg_channel') {
      const channel = '@GramfarmAimining';
      const cleanId = String(userId).trim();

      const bot = getBot();
      if (!bot) {
        return res.json({
          success: false,
          message: 'Telegram Bot service not available on server.'
        });
      }

      // Ensure user is accessing with real Telegram user ID
      if (!/^\d+$/.test(cleanId)) {
        return res.json({
          success: false,
          message: 'Please open this app inside Telegram (@gramframaibot) to verify your channel membership!'
        });
      }

      try {
        const member = await bot.telegram.getChatMember(channel, Number(cleanId));
        const validStatuses = ['member', 'administrator', 'creator', 'restricted'];
        if (!member || !validStatuses.includes(member.status)) {
          return res.json({
            success: false,
            message: 'You have not joined @GramfarmAimining yet! Please join the channel and try again.'
          });
        }
      } catch (tgErr) {
        return res.json({
          success: false,
          message: 'Could not verify channel membership. Please make sure you joined @GramfarmAimining!'
        });
      }
    }

    const result = db.completeTask(userId, taskId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Bind TON / Tonkeeper wallet
router.post('/wallet/bind', (req, res) => {
  try {
    const { userId, walletAddress, walletName } = req.body;
    if (!userId || !walletAddress) {
      return res.status(400).json({ success: false, message: 'Wallet address required' });
    }
    const result = db.bindWallet(userId, walletAddress, walletName || 'Tonkeeper');
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Disconnect wallet
router.post('/wallet/disconnect', (req, res) => {
  try {
    const { userId } = req.body;
    const result = db.disconnectWallet(userId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Bind Referral code
router.post('/referral/bind', (req, res) => {
  try {
    const { userId, refCode } = req.body;
    const result = db.bindReferrer(userId, refCode);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Open Mystery Gift Box (Earn 0.0100 - 0.0500 TON / GRAM)
router.post('/mystery-box/open', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID is required' });
    const result = db.openMysteryBox(userId);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Withdraw GRAM to Tonkeeper
router.post('/wallet/withdraw', (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) return res.status(400).json({ success: false, message: 'Missing parameters' });

    const user = db.getUser(userId);
    if (user.is_banned) {
      return res.status(403).json({ success: false, message: `Your account is suspended: ${user.ban_reason || 'Banned by Admin'}` });
    }

    const result = db.withdrawFunds(userId, amount);
    if (result.success && result.withdrawal) {
      const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || '179.65.221.12';

      // 1. Notify User on main bot & Alert Admin in parallel
      Promise.allSettled([
        notifyWithdrawalPending(userId, {
          amount: result.withdrawal.amount,
          destination: result.withdrawal.destination,
          withdrawalId: result.withdrawal.id
        }),
        sendAlertWithdrawalRequest({
          withdrawal: result.withdrawal,
          user: user,
          ip: clientIp
        })
      ]).catch(() => {});
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Deposit GRAM via Tonkeeper with Real On-Chain Blockchain Scanning & Verification
router.post('/wallet/deposit', async (req, res) => {
  try {
    const { userId, amountGram, amount, txHash } = req.body;
    const finalAmount = amountGram !== undefined ? amountGram : amount;
    if (!userId || finalAmount === undefined || !txHash) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing deposit parameters (User ID, Amount, or Transaction Hash required)' 
      });
    }

    const requestedAmount = Number(finalAmount);
    if (isNaN(requestedAmount) || requestedAmount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Minimum deposit amount is 1.00 GRAM. Amounts below 1 GRAM cannot be credited.'
      });
    }

    // 1. Verify transaction on TON Blockchain (Toncenter / TonAPI)
    const verification = await verifyTonkeeperDepositOnChain(txHash, requestedAmount);

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message
      });
    }

    // 2. Transaction is genuine on-chain -> credit balance & prevent double-claiming
    const creditAmount = verification.verifiedAmount || requestedAmount;
    const result = db.depositFunds(userId, creditAmount, verification.txHash || txHash, verification.senderAddress);

    if (!result.success) {
      return res.status(400).json(result);
    }

    const updatedUser = db.getUser(userId);
    const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || '179.65.221.12';

    // 1. Notify User on main bot & Alert Admin in parallel
    Promise.allSettled([
      notifyDepositSuccess(userId, {
        amountGram: creditAmount,
        txHash: verification.txHash || txHash,
        senderAddress: verification.senderAddress,
        depositBalance: updatedUser.deposit_balance
      }),
      sendAlertDeposit({
        amount: creditAmount,
        user: updatedUser,
        txHash: verification.txHash || txHash,
        senderAddress: verification.senderAddress,
        depositBalance: updatedUser.deposit_balance,
        ip: clientIp
      })
    ]).catch(() => {});

    return res.json({
      ...result,
      verifiedOnChain: true,
      senderAddress: verification.senderAddress
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Claim Promo / Gift Code (GRAM Tokens)
router.post('/gift-code/claim', (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ success: false, message: 'User ID and Gift Code are required' });
    }
    const result = db.claimGiftCode(userId, code);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

