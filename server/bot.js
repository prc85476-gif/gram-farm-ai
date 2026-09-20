import { Telegraf, Markup } from 'telegraf';
import { db } from './db.js';

let botInstance = null;

export function getBot() {
  return botInstance;
}

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
          referralNotice = `\n\n🎉 *Invited by Partner:* Successfully linked to your inviter! 15 GH/s Starter bonus activated!`;
          
          // Notify the referrer on Telegram
          try {
            const inviterId = bindResult.referrerId;
            const newUserName = ctx.from.first_name || (ctx.from.username ? `@${ctx.from.username}` : 'A new miner');
            const referrerMsg = 
              `🎉 *New Mining Buddy Joined!*\n\n` +
              `👤 *${newUserName}* joined Gram Farm using your referral link!\n` +
              `🎁 *+1 Mystery Gift Box* has been added to your inventory!\n` +
              `⚡ You will also earn *10% lifetime commission* on all their mined GRAM.`;

            await ctx.telegram.sendMessage(inviterId, referrerMsg, { parse_mode: 'Markdown' });
          } catch (notifErr) {
            console.log('⚠️ Could not send Telegram alert to referrer:', notifErr.message);
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

👇 *Click the button below to launch the Gram Mining App:*
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
        `💎 GRAM Balance: *${user.gram_balance.toFixed(2)} GRAM*\n` +
        `⚡ Pending to Claim: *${user.unclaimed_gram.toFixed(4)} GRAM*`
      );
    });

    bot.action('ref_stats', async (ctx) => {
      const userId = String(ctx.from.id);
      const user = db.getUser(userId);
      await ctx.answerCbQuery();
      const botUsername = ctx.botInfo?.username || 'gramframaibot';
      const refLink = `https://t.me/${botUsername}?start=ref_${user.referral_code}`;
      await ctx.replyWithMarkdown(
        `👥 *Your Referral & Partner Stats:*\n\n` +
        `🔗 *Your Referral Link:*\n\`${refLink}\`\n\n` +
        `🤝 Friends Invited: *${user.referrals_count || 0}*\n` +
        `🎁 Mystery Gift Boxes: *${user.mystery_boxes_available || 0} Available*\n` +
        `💰 Total 10% Commission: *${(user.referral_earnings || 0).toFixed(4)} GRAM*\n\n` +
        `💡 *Share your link to earn 1 Mystery Box + 10% commission per referral!*`
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

    bot.launch().then(() => {
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
