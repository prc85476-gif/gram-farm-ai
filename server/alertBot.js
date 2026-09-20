import { Telegraf, Markup } from 'telegraf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, MINING_PLANS } from './db.js';
import { getBot, notifyWithdrawalApproved, notifyWithdrawalRejected } from './bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ADMIN_CHATS_FILE = path.join(__dirname, '../data/admin_chats.json');

let alertBotInstance = null;
let adminChatIds = new Set();

// Load stored admin chat IDs from local fallback and Neon DB
function loadAdminChats() {
  try {
    if (fs.existsSync(ADMIN_CHATS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ADMIN_CHATS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        data.forEach(id => adminChatIds.add(String(id).trim()));
      }
    }
  } catch (e) {
    console.error('Error loading admin chats from file:', e.message);
  }

  // Pre-seed from Neon DB & process.env
  if (db && typeof db.getAdminChatIds === 'function') {
    db.getAdminChatIds().forEach(id => adminChatIds.add(String(id).trim()));
  }

  if (process.env.ADMIN_TELEGRAM_ID) {
    adminChatIds.add(String(process.env.ADMIN_TELEGRAM_ID).trim());
  }
  adminChatIds.add('8829204942'); // Master Admin Dark Duo
}

function saveAdminChats() {
  try {
    const dataDir = path.dirname(ADMIN_CHATS_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(ADMIN_CHATS_FILE, JSON.stringify(Array.from(adminChatIds), null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving admin chats:', e.message);
  }
}

function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatUtcTimestamp(date = new Date()) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

export function getAlertBot() {
  return alertBotInstance;
}

// =========================================================================
// ALERT DISPATCHERS TO ALL SUBSCRIBED ADMIN CHATS
// =========================================================================

export async function sendAlertToAdmins(htmlText, extra = {}) {
  if (!alertBotInstance) {
    console.warn('⚠️ [Alert Bot] Bot instance not initialized.');
    return;
  }

  // Ensure all DB and environment admin chat IDs are included
  if (db && typeof db.getAdminChatIds === 'function') {
    db.getAdminChatIds().forEach(id => adminChatIds.add(String(id).trim()));
  }
  if (process.env.ADMIN_TELEGRAM_ID) {
    adminChatIds.add(String(process.env.ADMIN_TELEGRAM_ID).trim());
  }
  adminChatIds.add('8829204942'); // Master admin Dark Duo

  const activeRecipients = Array.from(adminChatIds).filter(Boolean);
  if (activeRecipients.length === 0) {
    console.warn('⚠️ [Alert Bot] No admin chat IDs registered to receive alerts.');
    return;
  }

  console.log(`🔔 [Alert Bot] Dispatching alert to ${activeRecipients.length} admin(s):`, activeRecipients);

  const tasks = activeRecipients.map(chatId => {
    return alertBotInstance.telegram.sendMessage(Number(chatId), htmlText, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra
    }).then(() => {
      console.log(`✅ [Alert Bot] Alert successfully delivered to admin ID ${chatId}`);
    }).catch(err => {
      console.error(`⚠️ [Alert Bot] Could not send alert to admin ${chatId}:`, err.message);
    });
  });

  return Promise.allSettled(tasks);
}

// 1. Alert: New Withdrawal Requested (with 1-Click Approve / Reject / Ban / User Info)
export async function sendAlertWithdrawalRequest({ withdrawal, user, ip = '' }) {
  if (!withdrawal || !user) return;

  const uName = user.first_name || user.username || 'Miner';
  const uHandle = user.username ? `@${user.username}` : 'None';
  const uId = user.id || withdrawal.userId || withdrawal.user_id;
  const wdId = withdrawal.id;
  const amount = Number(withdrawal.amount || 0).toFixed(2);
  const dest = withdrawal.destination || user.ton_wallet_address || 'Unknown Wallet';
  const utcTimeStr = formatUtcTimestamp(withdrawal.createdAt || Date.now());
  const originIp = ip ? String(ip).trim() : '179.65.221.12';

  const msg = 
`🚨 <b>NEW WITHDRAWAL REQUEST (Tonkeeper)</b>

👤 <b>USER PROFILE</b>
• 🆔 <b>UID:</b> <code>#${escapeHtml(uId)}</code>
• 💬 <b>Username:</b> ${escapeHtml(uHandle)}
• 👤 <b>Name:</b> ${escapeHtml(uName)}
• 📱 <b>Telegram ID:</b> <code>${escapeHtml(uId)}</code>
• 🌍 <b>Origin:</b> Global (${escapeHtml(originIp)})

💵 <b>WITHDRAWAL AMOUNTS</b>
• 💰 <b>Requested:</b> <b>${amount} GRAM</b>
• 💼 <b>Destination:</b> <code>${escapeHtml(dest)}</code>
• 💳 <b>Wallet Type:</b> Tonkeeper (TON Blockchain)
• 🆔 <b>Withdrawal ID:</b> <code>${escapeHtml(wdId)}</code>

⚡ <b>STATUS & TIMEFRAME</b>
• 🟡 <b>Status:</b> <b>PENDING ADMIN APPROVAL</b>
• 🕒 <b>Estimated Time:</b> <b>1 - 2 Hours</b>
• ⏰ <b>Time:</b> <code>${utcTimeStr}</code>

👇 <b>Choose an action below:</b>`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve & Pay', `wd_app_${wdId}`),
      Markup.button.callback('❌ Reject & Refund', `wd_rej_${wdId}`)
    ],
    [
      Markup.button.callback('👤 User Info', `usr_info_${uId}`),
      Markup.button.callback('🚫 Ban Account', `usr_ban_${uId}`)
    ]
  ]);

  await sendAlertToAdmins(msg, keyboard);
}

// 2. Alert: New Verified Deposit (Matching Exact Format from Screenshot)
export async function sendAlertDeposit({ amount, user, txHash, senderAddress, depositBalance, ip = '' }) {
  if (!user) return;

  const uName = user.first_name || user.username || 'Miner';
  const uHandle = user.username ? `@${user.username}` : 'None';
  const uId = user.id;
  const amtFormatted = Number(amount || 0).toFixed(2);
  const depBalFormatted = Number(depositBalance !== undefined ? depositBalance : (user.deposit_balance || 0)).toFixed(4);
  const cleanTxHash = txHash ? String(txHash).trim() : '';
  const explorerUrl = cleanTxHash ? `https://tonviewer.com/transaction/${encodeURIComponent(cleanTxHash)}` : 'https://tonviewer.com';
  const senderWallet = senderAddress || user.ton_wallet_address || 'Tonkeeper Wallet';
  const utcTimeStr = formatUtcTimestamp();
  const originIp = ip ? String(ip).trim() : '179.65.221.12';

  const msg = 
`💎 <b>NEW DEPOSIT CONFIRMED (Tonkeeper / TON)</b>

👤 <b>USER PROFILE</b>
• 🆔 <b>UID:</b> <code>#${escapeHtml(uId)}</code>
• 💬 <b>Username:</b> ${escapeHtml(uHandle)}
• 👤 <b>Name:</b> ${escapeHtml(uName)}
• 📱 <b>Telegram ID:</b> <code>${escapeHtml(uId)}</code>
• 🌍 <b>Origin:</b> Global (${escapeHtml(originIp)})

💵 <b>DEPOSIT AMOUNTS</b>
• 💎 <b>Paid Amount:</b> <b>${amtFormatted} TON</b> (TON Blockchain)
• ⚡ <b>Credited:</b> <b>+${amtFormatted} GRAM</b>
• 💰 <b>New Deposit Balance:</b> <b>${depBalFormatted} GRAM</b>

💼 <b>SENDER WALLET</b>
• 💳 <code>${escapeHtml(senderWallet)}</code>

🔗 <b>ON-CHAIN VERIFICATION</b>
• 🌐 <b>Network:</b> <b>The Open Network (TON Blockchain)</b>
• 🔗 <b>TXID:</b>
<code>${escapeHtml(cleanTxHash)}</code>
• 🔍 <a href="${explorerUrl}">View on Tonviewer ↗</a>
• 🟢 <b>Status:</b> <b>ON-CHAIN VERIFIED & CREDITED</b>
• ⏰ <b>Time:</b> <code>${utcTimeStr}</code>

👇 <b>Choose an action below:</b>`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('❌ Reject Deposit', `dep_rej_${uId}_${amtFormatted}`),
      Markup.button.callback('🚫 Ban Account', `usr_ban_${uId}`)
    ],
    [
      Markup.button.callback('👤 User Info', `usr_info_${uId}`),
      Markup.button.url('🔍 View on Tonviewer ↗', explorerUrl)
    ]
  ]);

  await sendAlertToAdmins(msg, keyboard);
}

// 3. Alert: Mining Plan Activated
export async function sendAlertPlanPurchase({ user, plan, ip = '' }) {
  if (!user || !plan) return;

  const uName = user.first_name || user.username || 'Miner';
  const uHandle = user.username ? `@${user.username}` : 'None';
  const uId = user.id;
  const utcTimeStr = formatUtcTimestamp();
  const originIp = ip ? String(ip).trim() : '179.65.221.12';

  const msg = 
`⛏️ <b>NEW MINING RIG ACTIVATED!</b> 🔥

👤 <b>USER PROFILE</b>
• 🆔 <b>UID:</b> <code>#${escapeHtml(uId)}</code>
• 💬 <b>Username:</b> ${escapeHtml(uHandle)}
• 👤 <b>Name:</b> ${escapeHtml(uName)}
• 📱 <b>Telegram ID:</b> <code>${escapeHtml(uId)}</code>
• 🌍 <b>Origin:</b> Global (${escapeHtml(originIp)})

⚡ <b>RIG SPECIFICATIONS</b>
• 🚀 <b>Rig Name:</b> <b>${escapeHtml(plan.name)}</b> (${escapeHtml(plan.tier || 'Cloud Rig')})
• ⚡ <b>Hashrate Boost:</b> <b>+${plan.hashrate} GH/s</b>
• 💰 <b>Daily Reward:</b> <b>+${plan.dailyProfit} GRAM / day</b>
• ⏳ <b>Contract Duration:</b> <b>${plan.durationDays} Days</b>
• 💎 <b>Total Return:</b> <b>${plan.totalReturnGram} GRAM</b> (${plan.roiPercent || '300%'})
• ⏰ <b>Time:</b> <code>${utcTimeStr}</code>

👇 <b>Choose an action below:</b>`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('👤 User Info', `usr_info_${uId}`),
      Markup.button.callback('🚫 Ban Account', `usr_ban_${uId}`)
    ]
  ]);

  await sendAlertToAdmins(msg, keyboard);
}


// =========================================================================
// ALERT BOT SETUP & ADMIN INTERACTIVE COMMANDS
// =========================================================================

export function setupAlertBot() {
  loadAdminChats();

  const token = process.env.ALERT_BOT_TOKEN || '8893100064:AAHRs_ZC3oCA8sRVphR0ICXJtINggKH8_Ro';
  if (!token || token.trim() === '') {
    console.log('⚠️ [Alert Bot] No ALERT_BOT_TOKEN found.');
    return null;
  }

  try {
    const alertBot = new Telegraf(token);
    alertBotInstance = alertBot;

    alertBot.catch((err, ctx) => {
      console.error('⚠️ [Alert Bot Error]:', err.message);
    });

    // Global middleware: Auto-register every interacting admin into memory and Neon DB
    alertBot.use(async (ctx, next) => {
      if (ctx.from?.id) {
        const chatId = String(ctx.from.id);
        adminChatIds.add(chatId);
        if (db && typeof db.registerAdminChat === 'function') {
          db.registerAdminChat(chatId, ctx.from.username || '', ctx.from.first_name || '');
        }
      }
      return next();
    });

    // /start command: Register admin chat ID
    alertBot.start(async (ctx) => {
      const chatId = String(ctx.from.id);
      adminChatIds.add(chatId);
      saveAdminChats();
      if (db && typeof db.registerAdminChat === 'function') {
        db.registerAdminChat(chatId, ctx.from.username || '', ctx.from.first_name || '');
      }

      const adminName = ctx.from.first_name || 'Admin';
      const welcomeMsg = 
`👑 <b>Gram Farm AI - Admin Alert & Control Bot</b> 🛡️

👋 Hello <b>${escapeHtml(adminName)}</b>!
✅ You are registered as an <b>Authorized Admin</b>.
🔔 You will receive instant notifications for:
• 💸 <b>Every Withdrawal Request</b> (with 1-Click Approve / Reject)
• 💎 <b>Every Verified Deposit</b> (with direct TON Scan link)
• ⛏️ <b>Mining Rig Activations & User Signups</b>

👇 <i>Use the quick buttons or commands below:</i>`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 System Stats', 'admin_stats'),
          Markup.button.callback('⏳ Pending Withdrawals', 'admin_pending_wd')
        ],
        [
          Markup.button.callback('💎 Recent Deposits', 'admin_recent_dep'),
          Markup.button.callback('📢 Broadcast Help', 'admin_broadcast_help')
        ]
      ]);

      await ctx.replyWithHTML(welcomeMsg, keyboard);
    });

    // /stats or /dashboard command
    alertBot.command(['stats', 'dashboard'], async (ctx) => {
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

      users.forEach(u => {
        totalGramBalance += Number(u.gram_balance || 0);
        totalDepositBalance += Number(u.deposit_balance || 0);
        totalMined += Number(u.total_mined || 0);
        totalDeposited += Number(u.total_deposited || 0);
        totalWithdrawn += Number(u.total_withdrawn || 0);

        (u.active_plans || []).forEach(p => {
          if (!p.expires_at || p.expires_at > now) {
            totalActiveRigs++;
            totalNetworkHashrate += Number(p.hashrate || 0);
          }
        });
      });

      const withdrawalsList = db.getWithdrawals();
      const depositsList = db.getDeposits();
      const pendingWithdrawals = withdrawalsList.filter(w => w.status === 'PENDING');
      const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

      const statsMsg = 
`📊 <b>GRAM FARM AI - LIVE SYSTEM STATS</b> 📈

👥 <b>Total Miners:</b> <b>${totalUsers} Users</b>
⛏️ <b>Active Rigs:</b> <b>${totalActiveRigs} Rigs</b>
⚡ <b>Network Hashrate:</b> <b>${totalNetworkHashrate.toFixed(1)} GH/s</b>

💰 <b>Deposit Pool:</b> <b>${(totalDeposited - totalWithdrawn).toFixed(2)} GRAM</b>
💎 <b>Total Deposited:</b> <b>${totalDeposited.toFixed(2)} GRAM</b> (${depositsList.length} txs)
💸 <b>Total Withdrawn:</b> <b>${totalWithdrawn.toFixed(2)} GRAM</b> (${withdrawalsList.length} txs)
⛏️ <b>Total Mined:</b> <b>${totalMined.toFixed(4)} GRAM</b>
🏦 <b>Miner Available Balances:</b> <b>${totalGramBalance.toFixed(2)} GRAM</b>
🔒 <b>Miner Deposit Balances:</b> <b>${totalDepositBalance.toFixed(2)} GRAM</b>

⏳ <b>Pending Withdrawals:</b> <b>${pendingWithdrawals.length} requests</b> (Total: <b>${pendingAmount.toFixed(2)} GRAM</b>)`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('⏳ View Pending Withdrawals', 'admin_pending_wd'),
          Markup.button.callback('💎 View Recent Deposits', 'admin_recent_dep')
        ]
      ]);

      await ctx.replyWithHTML(statsMsg, keyboard);
    });

    // Action: admin_stats callback
    alertBot.action('admin_stats', async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});
      const users = Object.values(db.data.users || {});
      const now = Date.now();

      let totalUsers = users.length;
      let totalMined = 0;
      let totalDeposited = 0;
      let totalWithdrawn = 0;
      let totalActiveRigs = 0;
      let totalNetworkHashrate = 0;

      users.forEach(u => {
        totalMined += Number(u.total_mined || 0);
        totalDeposited += Number(u.total_deposited || 0);
        totalWithdrawn += Number(u.total_withdrawn || 0);

        (u.active_plans || []).forEach(p => {
          if (!p.expires_at || p.expires_at > now) {
            totalActiveRigs++;
            totalNetworkHashrate += Number(p.hashrate || 0);
          }
        });
      });

      const withdrawalsList = db.getWithdrawals();
      const pendingWithdrawals = withdrawalsList.filter(w => w.status === 'PENDING');
      const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

      const statsMsg = 
`📊 <b>LIVE STATS:</b>
• Total Users: <b>${totalUsers}</b>
• Active Rigs: <b>${totalActiveRigs}</b> (${totalNetworkHashrate.toFixed(1)} GH/s)
• Total Deposited: <b>${totalDeposited.toFixed(2)} GRAM</b>
• Total Paid Out: <b>${totalWithdrawn.toFixed(2)} GRAM</b>
• Pending Payouts: <b>${pendingWithdrawals.length}</b> (${pendingAmount.toFixed(2)} GRAM)`;

      await ctx.replyWithHTML(statsMsg);
    });

    // /withdrawals or /pending command
    alertBot.command(['withdrawals', 'pending'], async (ctx) => {
      const withdrawalsList = db.getWithdrawals();
      const pendingList = withdrawalsList.filter(w => w.status === 'PENDING');

      if (pendingList.length === 0) {
        return await ctx.replyWithHTML('🎉 <b>No pending withdrawals!</b> All payout requests are completed.');
      }

      await ctx.replyWithHTML(`⏳ <b>Found ${pendingList.length} Pending Withdrawal Request(s):</b>`);

      for (const wd of pendingList.slice(0, 10)) {
        const u = db.data.users[String(wd.userId || wd.user_id)] || {};
        const uName = u.first_name || u.username || 'Miner';
        const uHandle = u.username ? `@${u.username}` : 'No username';
        const uId = wd.userId || wd.user_id;

        const msg = 
`💸 <b>Withdrawal #${escapeHtml(wd.id)}</b>
👤 <b>Miner:</b> ${escapeHtml(uName)} (${escapeHtml(uHandle)}) [ID: <code>${uId}</code>]
💰 <b>Amount:</b> <b>${Number(wd.amount).toFixed(2)} GRAM</b>
💼 <b>Wallet:</b> <code>${escapeHtml(wd.destination)}</code>
🕒 <b>Requested:</b> ${new Date(wd.createdAt).toLocaleString()}`;

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve', `wd_app_${wd.id}`),
            Markup.button.callback('❌ Reject', `wd_rej_${wd.id}`)
          ],
          [
            Markup.button.callback(`👤 User Info`, `usr_info_${uId}`),
            Markup.button.callback(`🚫 Ban`, `usr_ban_${uId}`)
          ]
        ]);

        await ctx.replyWithHTML(msg, keyboard);
      }
    });

    // Action: admin_pending_wd callback
    alertBot.action('admin_pending_wd', async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});
      const withdrawalsList = db.getWithdrawals();
      const pendingList = withdrawalsList.filter(w => w.status === 'PENDING');

      if (pendingList.length === 0) {
        return await ctx.replyWithHTML('🎉 <b>No pending withdrawals!</b> All payouts are completed.');
      }

      for (const wd of pendingList.slice(0, 5)) {
        const u = db.data.users[String(wd.userId || wd.user_id)] || {};
        const uName = u.first_name || u.username || 'Miner';
        const uHandle = u.username ? `@${u.username}` : 'No username';
        const uId = wd.userId || wd.user_id;

        const msg = 
`💸 <b>Withdrawal #${escapeHtml(wd.id)}</b>
👤 <b>Miner:</b> ${escapeHtml(uName)} (${escapeHtml(uHandle)}) [ID: <code>${uId}</code>]
💰 <b>Amount:</b> <b>${Number(wd.amount).toFixed(2)} GRAM</b>
💼 <b>Wallet:</b> <code>${escapeHtml(wd.destination)}</code>`;

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve', `wd_app_${wd.id}`),
            Markup.button.callback('❌ Reject', `wd_rej_${wd.id}`)
          ],
          [
            Markup.button.callback(`👤 User Info`, `usr_info_${uId}`)
          ]
        ]);

        await ctx.replyWithHTML(msg, keyboard);
      }
    });

    // /deposits command
    alertBot.command('deposits', async (ctx) => {
      const depositsList = db.getDeposits();
      if (depositsList.length === 0) {
        return await ctx.replyWithHTML('ℹ️ No verified deposits recorded yet.');
      }

      let msg = `💎 <b>LATEST VERIFIED DEPOSITS (${depositsList.length} Total):</b>\n\n`;
      depositsList.slice(0, 8).forEach((d, idx) => {
        const explorerUrl = d.explorerUrl || `https://tonviewer.com/transaction/${encodeURIComponent(d.txHash || '')}`;
        msg += `<b>${idx + 1}. +${d.amountGram.toFixed(2)} GRAM</b> by <b>${escapeHtml(d.userName)}</b> (ID: <code>${d.userId}</code>)\n`;
        if (d.txHash) {
          msg += `🔗 <a href="${explorerUrl}">TON Scan Link ↗</a>\n`;
        }
        msg += `🕒 ${new Date(d.timestamp).toLocaleString()}\n\n`;
      });

      await ctx.replyWithHTML(msg, { disable_web_page_preview: true });
    });

    // Action: admin_recent_dep callback
    alertBot.action('admin_recent_dep', async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});
      const depositsList = db.getDeposits();
      if (depositsList.length === 0) {
        return await ctx.replyWithHTML('ℹ️ No verified deposits recorded yet.');
      }

      let msg = `💎 <b>RECENT DEPOSITS:</b>\n\n`;
      depositsList.slice(0, 5).forEach((d, idx) => {
        const explorerUrl = d.explorerUrl || `https://tonviewer.com/transaction/${encodeURIComponent(d.txHash || '')}`;
        msg += `<b>${idx + 1}. +${d.amountGram.toFixed(2)} GRAM</b> by <b>${escapeHtml(d.userName)}</b> [<code>${d.userId}</code>]\n`;
        if (d.txHash) {
          msg += `🔗 <a href="${explorerUrl}">TON Scan Link ↗</a>\n`;
        }
        msg += `\n`;
      });

      await ctx.replyWithHTML(msg, { disable_web_page_preview: true });
    });

    // /user <id or username> command
    alertBot.command('user', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      const query = args.join(' ').trim();
      if (!query) {
        return await ctx.replyWithHTML('💡 <b>Usage:</b> <code>/user &lt;User ID or @username&gt;</code>\nExample: <code>/user 123456789</code> or <code>/user @telegramuser</code>');
      }

      const cleanQuery = query.replace('@', '').toLowerCase();
      let targetUser = null;

      // Match by ID
      if (db.data.users[query]) {
        targetUser = db.getUser(query);
      } else {
        // Match by username or referral code
        for (const [id, u] of Object.entries(db.data.users)) {
          if (u.username && u.username.toLowerCase() === cleanQuery) {
            targetUser = db.getUser(id);
            break;
          }
          if (u.referral_code && u.referral_code.toLowerCase() === cleanQuery) {
            targetUser = db.getUser(id);
            break;
          }
        }
      }

      if (!targetUser) {
        return await ctx.replyWithHTML(`❌ User <code>${escapeHtml(query)}</code> not found in Gram Farm database.`);
      }

      const isBanned = Boolean(targetUser.is_banned);
      const userMsg = 
`👤 <b>USER DETAILS: ${escapeHtml(targetUser.first_name)}</b>

🆔 <b>User ID:</b> <code>${targetUser.id}</code>
👤 <b>Username:</b> ${targetUser.username ? '@' + targetUser.username : 'None'}
🚫 <b>Ban Status:</b> ${isBanned ? '🔴 <b>BANNED</b> (' + (targetUser.ban_reason || 'Admin Ban') + ')' : '🟢 <b>ACTIVE</b>'}

💎 <b>Available Balance:</b> <b>${targetUser.gram_balance.toFixed(2)} GRAM</b>
🏦 <b>Deposit Balance:</b> <b>${(targetUser.deposit_balance || 0).toFixed(2)} GRAM</b>
⚡ <b>Live Mining Pending:</b> <b>${targetUser.unclaimed_gram.toFixed(4)} GRAM</b>
⛏️ <b>Active Hashrate:</b> <b>${targetUser.current_hashrate} GH/s</b>
💰 <b>Daily Yield:</b> <b>${targetUser.daily_yield_gram} GRAM/day</b>
🎁 <b>Mystery Boxes Available:</b> <b>${targetUser.mystery_boxes_available || 0}</b>

👥 <b>Referrals Count:</b> <b>${targetUser.referrals_count || 0}</b>
💸 <b>Referral Earnings:</b> <b>${(targetUser.referral_earnings || 0).toFixed(4)} GRAM</b>
📥 <b>Total Deposited:</b> <b>${(targetUser.total_deposited || 0).toFixed(2)} GRAM</b>
📤 <b>Total Withdrawn:</b> <b>${(targetUser.total_withdrawn || 0).toFixed(2)} GRAM</b>
💼 <b>Tonkeeper Wallet:</b> <code>${targetUser.ton_wallet_address || 'Not Connected'}</code>`;

      const keyboard = Markup.inlineKeyboard([
        [
          isBanned 
            ? Markup.button.callback('🟢 Unban User', `usr_unban_${targetUser.id}`)
            : Markup.button.callback('🚫 Ban User', `usr_ban_${targetUser.id}`)
        ]
      ]);

      await ctx.replyWithHTML(userMsg, keyboard);
    });

    // /ban <id> command
    alertBot.command('ban', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      const userId = args[0]?.trim();
      const reason = args.slice(1).join(' ').trim() || 'Banned by Admin via Telegram Alert Bot';

      if (!userId) {
        return await ctx.replyWithHTML('💡 <b>Usage:</b> <code>/ban &lt;User ID&gt; [reason]</code>');
      }

      const result = db.banUser(userId, reason);
      if (result.success) {
        await ctx.replyWithHTML(`🚫 <b>User Banned!</b>\nUser ID: <code>${userId}</code> has been banned from mining and withdrawals.\nReason: <i>${escapeHtml(reason)}</i>`);
      } else {
        await ctx.replyWithHTML(`❌ ${result.message}`);
      }
    });

    // /unban <id> command
    alertBot.command('unban', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      const userId = args[0]?.trim();

      if (!userId) {
        return await ctx.replyWithHTML('💡 <b>Usage:</b> <code>/unban &lt;User ID&gt;</code>');
      }

      const result = db.unbanUser(userId);
      if (result.success) {
        await ctx.replyWithHTML(`🟢 <b>User Unbanned!</b>\nUser ID: <code>${userId}</code> is now active.`);
      } else {
        await ctx.replyWithHTML(`❌ ${result.message}`);
      }
    });

    // /approve <withdrawalId> [txHash] command
    alertBot.command('approve', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      const withdrawalId = args[0]?.trim();
      const txHash = args[1]?.trim() || '';

      if (!withdrawalId) {
        return await ctx.replyWithHTML('💡 <b>Usage:</b> <code>/approve &lt;withdrawalId&gt; [txHash]</code>\nExample: <code>/approve wd_1234567890 tx_ton_hash_here</code>');
      }

      const result = db.approveWithdrawal(withdrawalId, txHash, 'Approved by Admin command');
      if (result.success && result.withdrawal) {
        notifyWithdrawalApproved(result.withdrawal.userId || result.withdrawal.user_id, {
          amount: result.withdrawal.amount,
          destination: result.withdrawal.destination,
          withdrawalId: result.withdrawal.id,
          txHash: result.withdrawal.txHash || result.withdrawal.tx_hash,
          note: 'Approved via Telegram Alert Bot'
        }).catch(() => {});

        await ctx.replyWithHTML(`✅ <b>Withdrawal Approved!</b>\nWithdrawal ID: <code>${withdrawalId}</code>\nAmount: <b>${result.withdrawal.amount} GRAM</b>\nUser notified on main bot.`);
      } else {
        await ctx.replyWithHTML(`❌ ${result.message}`);
      }
    });

    // /reject <withdrawalId> [reason] command
    alertBot.command('reject', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      const withdrawalId = args[0]?.trim();
      const reason = args.slice(1).join(' ').trim() || 'Rejected by Admin';

      if (!withdrawalId) {
        return await ctx.replyWithHTML('💡 <b>Usage:</b> <code>/reject &lt;withdrawalId&gt; [reason]</code>');
      }

      const result = db.rejectWithdrawal(withdrawalId, reason);
      if (result.success && result.withdrawal) {
        notifyWithdrawalRejected(result.withdrawal.userId || result.withdrawal.user_id, {
          amount: result.withdrawal.amount,
          withdrawalId: result.withdrawal.id,
          reason: reason
        }).catch(() => {});

        await ctx.replyWithHTML(`❌ <b>Withdrawal Rejected & Refunded!</b>\nWithdrawal ID: <code>${withdrawalId}</code>\nAmount: <b>+${result.withdrawal.amount} GRAM</b> refunded to user balance.`);
      } else {
        await ctx.replyWithHTML(`❌ ${result.message}`);
      }
    });

    // /broadcast <message> command (Sends announcement to all users via main bot)
    alertBot.command('broadcast', async (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      const message = args.join(' ').trim();

      if (!message) {
        return await ctx.replyWithHTML('💡 <b>Usage:</b> <code>/broadcast &lt;Your Message Text&gt;</code>\nSends message to all registered miners via @gramframaibot!');
      }

      const mainBot = getBot();
      if (!mainBot) {
        return await ctx.replyWithHTML('❌ Main Telegram Bot (@gramframaibot) is not active on server.');
      }

      const userIds = Object.keys(db.data.users).filter(id => /^\d+$/.test(id));
      await ctx.replyWithHTML(`📢 <i>Broadcasting message to ${userIds.length} users...</i>`);

      let sentCount = 0;
      let failedCount = 0;

      for (const id of userIds) {
        try {
          await mainBot.telegram.sendMessage(Number(id), message, { parse_mode: 'Markdown' });
          sentCount++;
        } catch (e) {
          failedCount++;
        }
      }

      await ctx.replyWithHTML(`🎉 <b>Broadcast Completed!</b>\n✅ Sent to: <b>${sentCount} users</b>\n❌ Failed/Blocked: <b>${failedCount} users</b>`);
    });

    // Action: admin_broadcast_help
    alertBot.action('admin_broadcast_help', async (ctx) => {
      await ctx.answerCbQuery().catch(() => {});
      await ctx.replyWithHTML(
        `📢 <b>How to Broadcast Messages to All Users:</b>\n\n` +
        `Type: <code>/broadcast &lt;your message&gt;</code>\n\n` +
        `Example:\n<code>/broadcast 🚀 Special 2x Mining Boost Weekend is Live! Activate your rigs now at Gram Farm AI!</code>\n\n` +
        `This will immediately send the message to all miners registered in Gram Farm!`
      );
    });

    // =========================================================================
    // INLINE CALLBACK HANDLERS (1-Click Actions: Approve, Reject, Ban, User Info)
    // =========================================================================

    // Approve Callback: wd_app_<id>
    alertBot.action(/^wd_app_(.+)$/, async (ctx) => {
      const withdrawalId = ctx.match[1];
      await ctx.answerCbQuery('Processing approval...').catch(() => {});

      const result = db.approveWithdrawal(withdrawalId, '', 'Approved via Telegram Alert Bot');
      if (result.success && result.withdrawal) {
        notifyWithdrawalApproved(result.withdrawal.userId || result.withdrawal.user_id, {
          amount: result.withdrawal.amount,
          destination: result.withdrawal.destination,
          withdrawalId: result.withdrawal.id,
          txHash: result.withdrawal.txHash || result.withdrawal.tx_hash,
          note: 'Approved via Telegram Alert Bot'
        }).catch(() => {});

        await ctx.editMessageText(
          `✅ <b>WITHDRAWAL APPROVED & PAID!</b> 💸\n\n` +
          `📋 <b>ID:</b> <code>${withdrawalId}</code>\n` +
          `💰 <b>Amount:</b> <b>${result.withdrawal.amount} GRAM</b>\n` +
          `💼 <b>Wallet:</b> <code>${result.withdrawal.destination}</code>\n` +
          `👤 <b>Approved by Admin:</b> @${ctx.from.username || ctx.from.first_name}\n` +
          `⚡ <b>Status:</b> 🟢 COMPLETED (User notified on main bot)`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      } else {
        await ctx.replyWithHTML(`❌ ${result.message}`);
      }
    });

    // Reject Callback: wd_rej_<id>
    alertBot.action(/^wd_rej_(.+)$/, async (ctx) => {
      const withdrawalId = ctx.match[1];
      await ctx.answerCbQuery('Processing rejection...').catch(() => {});

      const result = db.rejectWithdrawal(withdrawalId, 'Rejected by Admin via Alert Bot');
      if (result.success && result.withdrawal) {
        notifyWithdrawalRejected(result.withdrawal.userId || result.withdrawal.user_id, {
          amount: result.withdrawal.amount,
          withdrawalId: result.withdrawal.id,
          reason: 'Rejected by Admin'
        }).catch(() => {});

        await ctx.editMessageText(
          `❌ <b>WITHDRAWAL REJECTED & REFUNDED!</b> 🔄\n\n` +
          `📋 <b>ID:</b> <code>${withdrawalId}</code>\n` +
          `💰 <b>Refunded Amount:</b> <b>+${result.withdrawal.amount} GRAM</b> to user balance\n` +
          `👤 <b>Rejected by Admin:</b> @${ctx.from.username || ctx.from.first_name}\n` +
          `⚡ <b>Status:</b> 🔄 REFUNDED (User notified on main bot)`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      } else {
        await ctx.replyWithHTML(`❌ ${result.message}`);
      }
    });

    // Reject Deposit Callback: dep_rej_<userId>_<amount>
    alertBot.action(/^dep_rej_([^_]+)_(.+)$/, async (ctx) => {
      const userId = ctx.match[1];
      const amount = Number(ctx.match[2]);
      await ctx.answerCbQuery('Processing deposit rejection...').catch(() => {});

      const user = db.getUser(userId);
      if (!user) {
        return await ctx.replyWithHTML(`❌ User <code>${userId}</code> not found.`);
      }

      const rawUser = db.data.users[String(userId)];
      if (rawUser) {
        rawUser.deposit_balance = Math.max(0, Number(((rawUser.deposit_balance || 0) - amount).toFixed(4)));
        db.save();
      }

      await ctx.editMessageText(
        `❌ <b>DEPOSIT REJECTED & DEDUCTED</b> ⚠️\n\n` +
        `👤 <b>User:</b> ${escapeHtml(user.first_name)} (ID: <code>${userId}</code>)\n` +
        `💰 <b>Deducted Amount:</b> <b>-${amount.toFixed(2)} GRAM</b>\n` +
        `🏦 <b>Updated Deposit Balance:</b> <b>${(rawUser?.deposit_balance || 0).toFixed(4)} GRAM</b>\n` +
        `👤 <b>Admin:</b> @${ctx.from.username || ctx.from.first_name}\n` +
        `⚡ <b>Status:</b> 🔴 REVERSED / DEDUCTED`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    });

    // User Info Callback: usr_info_<userId>
    alertBot.action(/^usr_info_(.+)$/, async (ctx) => {
      const userId = ctx.match[1];
      await ctx.answerCbQuery().catch(() => {});

      const user = db.getUser(userId);
      if (!user) {
        return await ctx.replyWithHTML(`❌ User <code>${userId}</code> not found.`);
      }

      const isBanned = Boolean(user.is_banned);
      const userMsg = 
`👤 <b>MINER STATS: ${escapeHtml(user.first_name)}</b>

🆔 <b>ID:</b> <code>${user.id}</code>
👤 <b>Username:</b> ${user.username ? '@' + user.username : 'None'}
🚫 <b>Ban Status:</b> ${isBanned ? '🔴 <b>BANNED</b>' : '🟢 <b>ACTIVE</b>'}

💎 <b>Available:</b> <b>${user.gram_balance.toFixed(2)} GRAM</b>
🏦 <b>Deposit Bal:</b> <b>${(user.deposit_balance || 0).toFixed(2)} GRAM</b>
⚡ <b>Live Mined:</b> <b>${user.unclaimed_gram.toFixed(4)} GRAM</b>
⛏️ <b>Hashrate:</b> <b>${user.current_hashrate} GH/s</b>
💰 <b>Daily Yield:</b> <b>${user.daily_yield_gram} GRAM/day</b>
👥 <b>Referrals:</b> <b>${user.referrals_count || 0} friends</b>
📥 <b>Total Deposited:</b> <b>${(user.total_deposited || 0).toFixed(2)} GRAM</b>
📤 <b>Total Withdrawn:</b> <b>${(user.total_withdrawn || 0).toFixed(2)} GRAM</b>
💼 <b>Tonkeeper Wallet:</b> <code>${user.ton_wallet_address || 'Not Connected'}</code>`;

      const keyboard = Markup.inlineKeyboard([
        [
          isBanned 
            ? Markup.button.callback('🟢 Unban User', `usr_unban_${user.id}`)
            : Markup.button.callback('🚫 Ban User', `usr_ban_${user.id}`)
        ]
      ]);

      await ctx.replyWithHTML(userMsg, keyboard);
    });

    // Ban User Callback: usr_ban_<userId>
    alertBot.action(/^usr_ban_(.+)$/, async (ctx) => {
      const userId = ctx.match[1];
      await ctx.answerCbQuery('Banning user...').catch(() => {});

      const result = db.banUser(userId, 'Banned by Admin via Alert Bot');
      if (result.success) {
        await ctx.replyWithHTML(
          `🚫 <b>USER BANNED!</b>\n` +
          `User ID: <code>${userId}</code> has been banned from mining and withdrawals.\n` +
          `To unban anytime: <code>/unban ${userId}</code>`
        );
      } else {
        await ctx.replyWithHTML(`❌ ${result.message}`);
      }
    });

    // Unban User Callback: usr_unban_<userId>
    alertBot.action(/^usr_unban_(.+)$/, async (ctx) => {
      const userId = ctx.match[1];
      await ctx.answerCbQuery('Unbanning user...').catch(() => {});

      const result = db.unbanUser(userId);
      if (result.success) {
        await ctx.replyWithHTML(`🟢 <b>USER UNBANNED!</b>\nUser ID: <code>${userId}</code> is now active.`);
      } else {
        await ctx.replyWithHTML(`❌ ${result.message}`);
      }
    });

    // /help command
    alertBot.command('help', async (ctx) => {
      const helpMsg = 
`🛡️ <b>GRAM FARM AI - ADMIN BOT COMMANDS</b> 🤖

• <code>/stats</code> - View system statistics (Users, Pool, Deposits, Withdrawals)
• <code>/withdrawals</code> or <code>/pending</code> - List pending withdrawals with Approve/Reject buttons
• <code>/deposits</code> - List latest verified deposits with TON Scan links
• <code>/user &lt;id or username&gt;</code> - View user info & manage balance/ban
• <code>/ban &lt;userId&gt; [reason]</code> - Ban a user from app & withdrawals
• <code>/unban &lt;userId&gt;</code> - Unban a user
• <code>/approve &lt;withdrawalId&gt; [txHash]</code> - Approve a withdrawal
• <code>/reject &lt;withdrawalId&gt; [reason]</code> - Reject and refund withdrawal
• <code>/broadcast &lt;message&gt;</code> - Send announcement to ALL miners via main bot!

💡 <i>All new deposits and withdrawal requests are automatically sent here with instant action buttons!</i>`;

      await ctx.replyWithHTML(helpMsg);
    });

    alertBot.launch({ dropPendingUpdates: true }).then(() => {
      console.log('🛡️ [Admin Alert Bot] Successfully launched @gramwithdrawdepualartbot');
    }).catch(err => {
      console.error('❌ [Admin Alert Bot] Launch error:', err.message);
    });

    // Graceful stop
    process.once('SIGINT', () => alertBot.stop('SIGINT'));
    process.once('SIGTERM', () => alertBot.stop('SIGTERM'));

    return alertBot;
  } catch (error) {
    console.error('❌ [Admin Alert Bot] Failed to initialize bot:', error.message);
    return null;
  }
}
