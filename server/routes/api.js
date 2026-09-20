import express from 'express';
import { db, MINING_PLANS, TASKS_CATALOG } from '../db.js';
import { getBot } from '../bot.js';
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
        const bot = getBot();
        if (bot) {
          try {
            const newUserName = first_name || (username ? `@${username}` : 'A new miner');
            const referrerMsg = 
              `🎉 *New Mining Buddy Joined!*\n\n` +
              `👤 *${newUserName}* joined Gram Farm using your referral link!\n` +
              `🎁 *+1 Mystery Gift Box* has been added to your inventory!\n` +
              `⚡ You will also earn *10% lifetime commission* on all their mined GRAM.`;

            bot.telegram.sendMessage(bindResult.referrerId, referrerMsg, { parse_mode: 'Markdown' }).catch(() => {});
          } catch (e) {}
        }
      }
    }

    return res.json({ success: true, user: db.getUser(userId) });
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
    const result = db.buyPlan(userId, planId, currency || 'GRAM');
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
      const token = process.env.BOT_TOKEN;
      const cleanId = String(userId).trim();

      if (!token) {
        return res.json({
          success: false,
          message: 'Telegram Bot Token not configured on server.'
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
        const checkUrl = `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(channel)}&user_id=${cleanId}`;
        const tgRes = await fetch(checkUrl);
        const tgData = await tgRes.json();

        if (!tgData.ok || !tgData.result) {
          return res.json({
            success: false,
            message: 'You have not joined @GramfarmAimining channel yet! Please join the channel first.'
          });
        }

        const status = tgData.result.status;
        const validStatuses = ['member', 'administrator', 'creator', 'restricted'];
        if (!validStatuses.includes(status)) {
          return res.json({
            success: false,
            message: 'You have not joined @GramfarmAimining yet! Please join the channel and try again.'
          });
        }
      } catch (e) {
        console.error('getChatMember check error:', e.message);
        return res.json({
          success: false,
          message: 'Error verifying Telegram channel membership. Please ensure you have joined @GramfarmAimining and try again.'
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
    const result = db.withdrawFunds(userId, amount);
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

