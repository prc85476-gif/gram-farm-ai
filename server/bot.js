import { Telegraf, Markup } from 'telegraf';
import { db, MINING_PLANS } from './db.js';

let botInstance = null;

export function getBot() {
  return botInstance;
}

// =========================================================================
// HTML ESCAPING & TELEGRAM DISPATCHER HELPERS
// =========================================================================

function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isNumericId(id) {
  return id && /^\d+$/.test(String(id).trim());
}

export async function sendTelegramMessage(userId, htmlText, extra = {}) {
  const bot = getBot();
  if (!bot) return false;
  if (!isNumericId(userId)) return false;

  try {
    const cleanId = Number(String(userId).trim());
    await bot.telegram.sendMessage(cleanId, htmlText, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra
    });
    return true;
  } catch (err) {
    console.log(`⚠️ [Telegram Notification] Could not send notification to user ${userId}:`, err.message);
    return false;
  }
}

// 1. Deposit Notification (Credit Confirmed with Tx ID & Balance)
export async function notifyDepositSuccess(userId, { amountGram, txHash, senderAddress, depositBalance }) {
  const user = db.getUser(userId) || {};
  const uName = user.first_name || user.username || 'Miner';
  const uHandle = user.username ? `@${user.username}` : `UID: #${userId}`;
  const amtFormatted = Number(amountGram || 0).toFixed(2);
  const balFormatted = Number(depositBalance || 0).toFixed(2);
  const cleanTxHash = txHash ? String(txHash).trim() : '';
  const explorerUrl = cleanTxHash ? `https://tonviewer.com/transaction/${encodeURIComponent(cleanTxHash)}` : null;

  const msg = 
`💎 <b>Deposit Credited Successfully!</b> ⛏️

👤 <b>Miner:</b> <b>${escapeHtml(uName)}</b> (${escapeHtml(uHandle)})
💰 <b>Credited Amount:</b> <b>+${amtFormatted} GRAM</b>
🏦 <b>Deposit Balance:</b> <b>${balFormatted} GRAM</b>
${cleanTxHash ? `🔗 <b>Transaction ID:</b> <code>${escapeHtml(cleanTxHash)}</code>\n` : ''}${explorerUrl ? `🔍 <a href="${explorerUrl}">View Transaction on TON Explorer</a>\n` : ''}${senderAddress ? `💼 <b>Sender Wallet:</b> <code>${escapeHtml(senderAddress)}</code>\n` : ''}⚡ <b>Status:</b> 🟢 Confirmed & Active

🚀 <i>Your deposit balance is ready! You can now activate high-yield Mining Rigs in the Mini App to start earning daily GRAM rewards.</i>`;

  return await sendTelegramMessage(userId, msg);
}

// 2. Withdrawal Requested (Pending with 1-2 Hours Timeframe)
export async function notifyWithdrawalPending(userId, { amount, destination, withdrawalId }) {
  const user = db.getUser(userId) || {};
  const uName = user.first_name || user.username || 'Miner';
  const uHandle = user.username ? `@${user.username}` : `UID: #${userId}`;
  const amtFormatted = Number(amount || 0).toFixed(2);
  const cleanDest = destination ? String(destination).trim() : 'Tonkeeper Wallet';
  const cleanId = withdrawalId ? String(withdrawalId).trim() : 'N/A';

  const msg = 
`⏳ <b>Withdrawal Request Submitted!</b> 💸

👤 <b>Miner:</b> <b>${escapeHtml(uName)}</b> (${escapeHtml(uHandle)})
💰 <b>Withdrawal Amount:</b> <b>${amtFormatted} GRAM</b>
💼 <b>Destination Wallet:</b> <code>${escapeHtml(cleanDest)}</code> (Tonkeeper)
🆔 <b>Withdrawal ID:</b> <code>${escapeHtml(cleanId)}</code>
⚡ <b>Status:</b> 🟡 <b>PENDING Admin Verification</b>
🕒 <b>Estimated Processing Time:</b> <b>1 - 2 Hours</b>

ℹ️ <i>Your withdrawal has been queued for verification. Once approved and sent to your Tonkeeper wallet on the TON Blockchain, you will receive an instant confirmation message here!</i>`;

  return await sendTelegramMessage(userId, msg);
}

// 3. Withdrawal Approved & Sent On-Chain
export async function notifyWithdrawalApproved(userId, { amount, destination, withdrawalId, txHash, note }) {
  const user = db.getUser(userId) || {};
  const uName = user.first_name || user.username || 'Miner';
  const uHandle = user.username ? `@${user.username}` : `UID: #${userId}`;
  const amtFormatted = Number(amount || 0).toFixed(2);
  const cleanDest = destination ? String(destination).trim() : 'Tonkeeper Wallet';
  const cleanId = withdrawalId ? String(withdrawalId).trim() : 'N/A';
  const cleanTx = txHash ? String(txHash).trim() : '';
  const explorerUrl = cleanTx ? `https://tonviewer.com/transaction/${encodeURIComponent(cleanTx)}` : null;

  const msg = 
`🎉 <b>Withdrawal Approved & Sent!</b> 🚀💎

👤 <b>Miner:</b> <b>${escapeHtml(uName)}</b> (${escapeHtml(uHandle)})
💰 <b>Amount Sent:</b> <b>${amtFormatted} GRAM</b>
💼 <b>Sent to Wallet:</b> <code>${escapeHtml(cleanDest)}</code> (Tonkeeper)
🆔 <b>Withdrawal ID:</b> <code>${escapeHtml(cleanId)}</code>
${cleanTx ? `🔗 <b>Transaction Hash:</b> <code>${escapeHtml(cleanTx)}</code>\n` : ''}${explorerUrl ? `🔍 <a href="${explorerUrl}">View on TON Explorer (Tonviewer)</a>\n` : ''}${note ? `📝 <b>Admin Note:</b> ${escapeHtml(note)}\n` : ''}✅ <b>Status:</b> 🟢 <b>COMPLETED (Dispatched On-Chain)</b>

💰 <i>Funds have been dispatched directly to your Tonkeeper wallet on The Open Network (TON). Thank you for mining with Gram Farm AI!</i>`;

  return await sendTelegramMessage(userId, msg);
}

// 4. Withdrawal Rejected & Refunded
export async function notifyWithdrawalRejected(userId, { amount, withdrawalId, reason }) {
  const user = db.getUser(userId) || {};
  const uName = user.first_name || user.username || 'Miner';
  const uHandle = user.username ? `@${user.username}` : `UID: #${userId}`;
  const amtFormatted = Number(amount || 0).toFixed(2);
  const cleanId = withdrawalId ? String(withdrawalId).trim() : 'N/A';
  const cleanReason = reason ? String(reason).trim() : 'Rejected by Admin';

  const msg = 
`❌ <b>Withdrawal Request Rejected & Refunded</b>

👤 <b>Miner:</b> <b>${escapeHtml(uName)}</b> (${escapeHtml(uHandle)})
💰 <b>Refunded Amount:</b> <b>+${amtFormatted} GRAM</b>
🆔 <b>Withdrawal ID:</b> <code>${escapeHtml(cleanId)}</code>
📝 <b>Reason:</b> ${escapeHtml(cleanReason)}
⚡ <b>Status:</b> 🔄 <b>Fully Refunded to Available Balance</b>

💡 <i>The requested funds have been returned to your Gram Farm available balance. If you need assistance, please contact our support team.</i>`;

  return await sendTelegramMessage(userId, msg);
}

// 5. Mining Plan / Rig Activated
export async function notifyPlanActivated(userId, { plan, expiresAt, isGift = false }) {
  if (!plan) return false;

  const expiryDate = expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : `${plan.durationDays || 30} Days`;

  const titleHeader = isGift 
    ? '🎁 <b>Mining Rig Gifted by Admin!</b> 🚀' 
    : '⛏️ <b>Mining Rig Activated Successfully!</b> 🚀';

  const msg = 
`${titleHeader}

⚡ <b>Mining Rig:</b> <b>${escapeHtml(plan.name)}</b> (${escapeHtml(plan.tier || 'Cloud Rig')})
🚀 <b>Hashrate Boost:</b> <b>+${plan.hashrate} GH/s</b>
💰 <b>Daily Mining Yield:</b> <b>+${plan.dailyProfit} GRAM / day</b>
⏳ <b>Contract Duration:</b> <b>${plan.durationDays} Days</b>
💎 <b>Total Estimated Return:</b> <b>${plan.totalReturnGram} GRAM (${plan.roiPercent || '300%'} Total ROI)</b>
📅 <b>Contract Active Until:</b> <b>${expiryDate}</b>

🔥 <i>Your cloud mining power is now actively producing GRAM tokens in real-time. Open the Mini App anytime to claim your accumulated mining rewards!</i>`;

  return await sendTelegramMessage(userId, msg);
}

// 6. Admin Manual Balance Adjustment
export async function notifyAdminBalanceAdjusted(userId, { amount, isAddition, balanceType = 'available', note, newBalance }) {
  const amtFormatted = Number(amount || 0).toFixed(2);
  const balFormatted = Number(newBalance || 0).toFixed(2);
  const typeLabel = balanceType === 'deposit' ? 'Deposit Balance' : 'Available Balance';

  const msg = 
`💎 <b>Account Balance Adjusted</b>

${isAddition ? '➕' : '➖'} <b>Adjustment:</b> <b>${isAddition ? '+' : '-'}${amtFormatted} GRAM</b> (${typeLabel})
💰 <b>Updated ${typeLabel}:</b> <b>${balFormatted} GRAM</b>
${note ? `📝 <b>Note:</b> ${escapeHtml(note)}\n` : ''}⚡ <b>Status:</b> ✅ Processed by Admin`;

  return await sendTelegramMessage(userId, msg);
}

// 7. Referral Pending Notification (When a friend starts the bot with referral link)
export async function notifyReferralPending(referrerId, { newUserName, newUserHandle, userId }) {
  const uName = newUserName || 'Miner';
  const uHandle = newUserHandle ? (newUserHandle.startsWith('@') ? newUserHandle : `@${newUserHandle}`) : (userId ? `ID: #${userId}` : '');

  const msg = 
`⏳ <b>New Referral Pending!</b> 👥

👤 <b>Invited Friend:</b> <b>${escapeHtml(uName)}</b> ${uHandle ? `(${escapeHtml(uHandle)})` : ''}
⚡ <b>Status:</b> 🟡 <b>PENDING Channel Verification</b>

ℹ️ <i>Your friend has joined using your referral link! Once they open the Mini App and join our 2 official Telegram channels, your referral will be counted and you will instantly receive:</i>

🎁 <b>+1 Mystery Gift Box</b> (Contains TON rewards)
⚡ <b>10% Lifetime Mining Commission</b> on all their mined GRAM`;

  return await sendTelegramMessage(referrerId, msg);
}

// 8. Referral Confirmed Notification (When the friend joins both channels in the Mini App)
export async function notifyReferralConfirmed(referrerId, { newUserName, newUserHandle, userId, totalReferrals, totalBoxes }) {
  const uName = newUserName || 'Miner';
  const uHandle = newUserHandle ? (newUserHandle.startsWith('@') ? newUserHandle : `@${newUserHandle}`) : (userId ? `ID: #${userId}` : '');
  const refCount = totalReferrals !== undefined ? totalReferrals : 'Active';
  const boxesCount = totalBoxes !== undefined ? totalBoxes : 'Available';

  const msg = 
`🎉 <b>Referral Confirmed & Reward Unlocked!</b> 🎁💎

👤 <b>Partner:</b> <b>${escapeHtml(uName)}</b> ${uHandle ? `(${escapeHtml(uHandle)})` : ''}
⚡ <b>Status:</b> 🟢 <b>VERIFIED (2 Channels Joined)</b>

🎁 <b>Reward Credited:</b> <b>+1 Mystery Gift Box</b> 📦
👥 <b>Total Active Referrals:</b> <b>${escapeHtml(String(refCount))}</b>
📦 <b>Available Mystery Boxes:</b> <b>${escapeHtml(String(boxesCount))}</b>
💰 <b>Commission:</b> <b>10% Lifetime Mining Commission Active</b>

🚀 <i>Your referral has been successfully counted! Open the Mini App now to unlock your Mystery Gift Box!</i>`;

  return await sendTelegramMessage(referrerId, msg);
}


// =========================================================================
// TELEGRAM BOT SETUP & INTERACTIVE HANDLERS
// =========================================================================

export function setupBot(appUrl) {
  const token = process.env.BOT_TOKEN;
  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE' || token.trim() === '') {
    console.log('⚠️ [Telegram Bot] No BOT_TOKEN found in .env. Running in Web Standalone mode.');
    console.log('💡 To link your bot, set BOT_TOKEN in .env file.');
    return null;
  }

  try {
    const bot = new Telegraf(token);
    botInstance = bot;

    bot.catch((err, ctx) => {
      console.error('⚠️ [Telegram Main Bot Error]:', err.message);
    });

    function createWebAppButton(text, url) {
      if (url && url.startsWith('https://')) {
        return Markup.button.webApp(text, url);
      }
      return Markup.button.callback(text + ' 🌐', 'local_mode_info');
    }

    // /start command with profile photo & referral support
    bot.start(async (ctx) => {
      const userId = String(ctx.from.id);
      
      // Fetch user profile photo via Telegram Bot API
      let photoUrl = null;
      try {
        const photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
        if (photos && photos.total_count > 0 && photos.photos[0]?.length > 0) {
          const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
          const fileLink = await ctx.telegram.getFileLink(fileId);
          photoUrl = fileLink.href;
        }
      } catch (e) {
        // Ignored if user has privacy settings on profile photo
      }
      
      // Update name/username/photo from Telegram
      db.syncUser(userId, {
        first_name: ctx.from.first_name || 'Miner',
        username: ctx.from.username || '',
        photo_url: photoUrl
      });

      // Extract referral payload (e.g. ref_GRAM12345 or GRAM12345 or 12345678)
      const rawText = ctx.message?.text || '';
      const parts = rawText.split(' ');
      const payload = ctx.payload || ctx.startPayload || (parts.length > 1 ? parts.slice(1).join(' ').trim() : '');

      let referralNotice = '';
      if (payload) {
        const bindResult = db.bindReferrer(userId, payload);
        if (bindResult.success && bindResult.referrerId) {
          const inviterId = bindResult.referrerId;
          const newUserName = ctx.from.first_name || (ctx.from.username ? `@${ctx.from.username}` : 'A new miner');
          const newUserHandle = ctx.from.username ? `@${ctx.from.username}` : null;

          if (bindResult.isPending) {
            referralNotice = `\n\n🎉 *Invited by Partner:* Successfully linked! Open the Mini App and join our 2 official channels to activate your 15 GH/s Starter bonus & confirm your referral!`;
            
            // Notify referrer of pending referral
            notifyReferralPending(inviterId, {
              newUserName,
              newUserHandle,
              userId
            }).catch(notifErr => {
              console.log('⚠️ Could not send Telegram pending alert to referrer:', notifErr.message);
            });
          } else {
            referralNotice = `\n\n🎉 *Invited by Partner:* Successfully linked to your inviter! 15 GH/s Starter bonus activated!`;
            
            // Referral immediately confirmed (user had already verified channels)
            notifyReferralConfirmed(inviterId, {
              newUserName,
              newUserHandle,
              userId,
              totalReferrals: bindResult.referrer?.referrals_count,
              totalBoxes: bindResult.referrer?.mystery_boxes_available
            }).catch(() => {});
          }
        }
      }

      const user = db.getUser(userId);
      const webAppUrl = appUrl || `http://localhost:${process.env.PORT || 3000}`;
      const launchButton = createWebAppButton('🚀 Launch Gram Farm App', webAppUrl);

      const isHttps = webAppUrl.startsWith('https://');
      const localNotice = !isHttps ? `\n\n🌐 *Local Web App:* [Open in Browser](${webAppUrl})` : '';

      const welcomeMessage = `
💎 *Welcome to GRAM Farm AI & Cloud Mining!* ⛏️

⚡ *Mine GRAM tokens in real-time on The Open Network (TON)!*
🚀 Boost your hash rate with high-yield GPU & ASIC Mining Plans.
🔗 Connect *Tonkeeper* for instant on-chain withdrawals.

🎁 *Referral Bonus:* 10% Lifetime Mining Commission + 1 Mystery Gift Box (0.01-0.05 TON) per friend!${referralNotice}${localNotice}

👇 *Click the button below to launch the Gram Mining App & verify channels:*
      `.trim();

      const keyboardRows = [
        [launchButton],
        [
          Markup.button.callback('⚡ Quick Hashrate', 'quick_stats'),
          Markup.button.callback('🎁 Daily Bonus', 'daily_bonus')
        ],
        [
          Markup.button.callback('👥 My Referral Stats', 'ref_stats'),
          Markup.button.url('📢 Official Telegram Community', 'https://t.me/GramfarmAimining')
        ]
      ];

      await ctx.replyWithMarkdown(welcomeMessage, {
        ...Markup.inlineKeyboard(keyboardRows)
      });
    });

    bot.action('local_mode_info', async (ctx) => {
      const targetUrl = appUrl || `http://localhost:${process.env.PORT || 3000}`;
      await ctx.answerCbQuery();
      await ctx.replyWithMarkdown(
        `💻 *Local Development Mode Active*\n\n` +
        `🌐 App is running locally at: \`${targetUrl}\`\n\n` +
        `👉 *Open in Browser:* ${targetUrl}\n\n` +
        `💡 *To launch inside Telegram:* Use an HTTPS tunnel like ngrok (\`npx ngrok http 3000\`) and set \`APP_URL=https://...\` in \`.env\`!`
      );
    });

    bot.action('quick_stats', async (ctx) => {
      const userId = String(ctx.from.id);
      const user = db.getUser(userId);
      await ctx.answerCbQuery();
      await ctx.replyWithMarkdown(
        `📊 *Your Mining Performance:*\n` +
        `⛏️ Active Hashrate: *${user.current_hashrate} GH/s*\n` +
        `💰 Daily Yield: *${user.daily_yield_gram} GRAM*\n` +
        `💎 Available Balance: *${user.gram_balance.toFixed(2)} GRAM*\n` +
        `🏦 Deposit Balance: *${(user.deposit_balance || 0).toFixed(2)} GRAM*\n` +
        `⚡ Pending to Claim: *${user.unclaimed_gram.toFixed(4)} GRAM*`
      );
    });

    bot.action('ref_stats', async (ctx) => {
      const userId = String(ctx.from.id);
      const user = db.getUser(userId);
      await ctx.answerCbQuery();
      const botUsername = ctx.botInfo?.username || 'gramframaibot';
      const refLink = `https://t.me/${botUsername}?start=ref_${user.referral_code}`;

      // Count pending referrals
      const pendingCount = Object.values(db.data.users || {}).filter(
        u => String(u.referred_by) === userId && !u.referral_confirmed
      ).length;

      await ctx.replyWithMarkdown(
        `👥 *Your Referral & Partner Stats:*\n\n` +
        `🔗 *Your Referral Link:*\n\`${refLink}\`\n\n` +
        `🤝 Confirmed Referrals: *${user.referrals_count || 0}*\n` +
        `⏳ Pending Channel Verification: *${pendingCount}*\n` +
        `🎁 Mystery Gift Boxes: *${user.mystery_boxes_available || 0} Available*\n` +
        `💰 Total 10% Commission: *${(user.referral_earnings || 0).toFixed(4)} GRAM*\n\n` +
        `💡 *Share your link! When friends start the bot and join both official channels in the Mini App, your referral is counted and you receive +1 Mystery Box + 10% commission!*`
      );
    });

    // /balance or /wallet command
    bot.command(['balance', 'wallet'], async (ctx) => {
      const userId = String(ctx.from.id);
      const user = db.getUser(userId);
      const webAppUrl = `${appUrl}?userId=${userId}&tab=wallet`;
      const walletConnected = user.ton_wallet_address 
        ? `\`${user.ton_wallet_address.substring(0, 8)}...${user.ton_wallet_address.slice(-6)}\` (${user.ton_wallet_type || 'Tonkeeper'})`
        : '_Not Connected yet_';

      await ctx.replyWithMarkdown(
        `💼 *Gram Farm AI - Wallet & Balances:*\n\n` +
        `💎 *Available (Withdrawable):* *${user.gram_balance.toFixed(2)} GRAM*\n` +
        `🏦 *Deposit Balance (Rigs):* *${(user.deposit_balance || 0).toFixed(2)} GRAM*\n` +
        `⚡ *Unclaimed Mined:* *${user.unclaimed_gram.toFixed(4)} GRAM*\n` +
        `💰 *Total Mined Lifetime:* *${(user.total_mined || 0).toFixed(4)} GRAM*\n` +
        `💼 *Linked Tonkeeper:* ${walletConnected}\n\n` +
        `🕒 *Withdrawal Time:* 1 - 2 Hours (Admin On-Chain Dispatch)`,
        Markup.inlineKeyboard([
          [createWebAppButton('💳 Open Wallet & Withdraw', webAppUrl)]
        ])
      );
    });

    bot.command('referral', async (ctx) => {
      const userId = String(ctx.from.id);
      const user = db.getUser(userId);
      const botUsername = ctx.botInfo?.username || 'gramframaibot';
      const refLink = `https://t.me/${botUsername}?start=ref_${user.referral_code}`;
      await ctx.replyWithMarkdown(
        `👥 *Gram Farm AI Referral Program*\n\n` +
        `Share your link to receive *+1 Mystery Gift Box* for every friend + *10% lifetime mining commission*!\n\n` +
        `🔗 *Your Invite Link:*\n\`${refLink}\`\n\n` +
        `📊 *Your Stats:*\n` +
        `• Total Friends: *${user.referrals_count || 0}*\n` +
        `• Mystery Boxes: *${user.mystery_boxes_available || 0}*\n` +
        `• Referral Earnings: *${(user.referral_earnings || 0).toFixed(4)} GRAM*`
      );
    });

    bot.command('invite', async (ctx) => {
      const userId = String(ctx.from.id);
      const user = db.getUser(userId);
      const botUsername = ctx.botInfo?.username || 'gramframaibot';
      const refLink = `https://t.me/${botUsername}?start=ref_${user.referral_code}`;
      await ctx.replyWithMarkdown(
        `🎁 *Invite Friends & Win 1.00 TON!*\n\n` +
        `• Invite 100 Friends to claim *1.00 TON* bonus reward!\n` +
        `• Earn *+1 Mystery Gift Box* (0.01 - 0.05 TON) per friend.\n` +
        `• Earn *10% lifetime commission* on all their mining.\n\n` +
        `🔗 *Invite Link:*\n\`${refLink}\``
      );
    });

    bot.action('daily_bonus', async (ctx) => {
      const userId = String(ctx.from.id);
      const result = db.completeTask(userId, 'daily_checkin');
      await ctx.answerCbQuery();
      if (result.success) {
        await ctx.replyWithMarkdown(`🎉 *Daily Streak Bonus Claimed!* +0.01 GRAM added to your wallet.`);
      } else {
        await ctx.replyWithMarkdown(`⏳ *${result.message}*`);
      }
    });

    bot.command('mine', async (ctx) => {
      const userId = String(ctx.from.id);
      const user = db.getUser(userId);
      const webAppUrl = `${appUrl}?userId=${userId}`;
      await ctx.replyWithMarkdown(
        `⛏️ *Live Mining Active:* ${user.unclaimed_gram.toFixed(4)} GRAM ready to claim!`,
        Markup.inlineKeyboard([
          [createWebAppButton('⚡ Open Mining Dashboard', webAppUrl)]
        ])
      );
    });

    bot.command('plans', async (ctx) => {
      const webAppUrl = `${appUrl}?userId=${ctx.from.id}&tab=plans`;
      await ctx.replyWithMarkdown(
        `🚀 *GRAM Investment & Mining Rigs:*\n\n` +
        `• *Tier 1: Starter Cloud Miner* - 1 GRAM (45 GH/s, 300% ROI = 3.00 GRAM)\n` +
        `• *Tier 2: Pro Dual Rig* - 5 GRAM (250 GH/s, 330% ROI = 16.50 GRAM)\n` +
        `• *Tier 3: ASIC Turbo X9* - 10 GRAM (650 GH/s, 350% ROI = 35.00 GRAM)\n` +
        `• *Tier 4: Quantum Supercluster* - 25 GRAM (2000 GH/s, 380% ROI = 95.00 GRAM)\n\n` +
        `Tap below to explore plans & boost your profit:`,
        Markup.inlineKeyboard([
          [createWebAppButton('🛒 View All Investment Plans', webAppUrl)]
        ])
      );
    });

    bot.command('help', async (ctx) => {
      const webAppUrl = appUrl || `http://localhost:${process.env.PORT || 3000}`;
      await ctx.replyWithMarkdown(
        `❓ *Gram Farm AI Help & Guides:*\n\n` +
        `⛏️ *How to Mine:* Free starter cloud miner generates GRAM in real-time. Tap Claim inside the app to collect rewards!\n\n` +
        `💎 *Deposit:* Deposit GRAM / TON using Tonkeeper to purchase high-yield Mining Rigs.\n\n` +
        `💸 *Withdrawal:* Connect Tonkeeper to withdraw your mined Available Balance. Processing time is *1-2 Hours*.\n\n` +
        `🎁 *Referrals:* Earn +1 Mystery Gift Box per invited friend + 10% lifetime mining commission.\n\n` +
        `💬 *Community:* Join @GramfarmAimining for daily bonus codes and updates!`,
        Markup.inlineKeyboard([
          [createWebAppButton('🚀 Launch Mini App', webAppUrl)]
        ])
      );
    });

    bot.launch({ dropPendingUpdates: true }).then(() => {
      console.log('🤖 [Telegram Bot] Successfully launched with @' + bot.botInfo?.username);
    }).catch(err => {
      console.error('❌ [Telegram Bot] Launch error:', err.message);
    });

    // Graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
  } catch (error) {
    console.error('❌ [Telegram Bot] Failed to initialize bot:', error.message);
    return null;
  }
}
