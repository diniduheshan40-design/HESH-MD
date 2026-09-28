const { getBotSettings, clearSettingsCache } = require('../lib/database');
const { boostChannelFollow, boostChannelReact } = require('../lib/boostEngine');
const { cleanDigits } = require('../lib/socket');

const PRICING = {
  react: { 50: 5, 100: 10, 300: 15, 400: 25 },
  follow: { 100: 100, 200: 200, 300: 250, 400: 320 }
};

module.exports = {
  name: 'boost',
  alias: ['channelboost'],
  category: 'tools',
  description: 'Boost WhatsApp Channel reacts and followers',
  async execute({ sock, msg, args, senderNumber }) {
    const from = msg.key.remoteJid;
    const botNum = cleanDigits(senderNumber);

    const type = args[0]?.toLowerCase();

    if (!type || !['react', 'follow'].includes(type)) {
      return await sock.sendMessage(from, {
        text: `*✦ CHANNEL BOOSTER ✦*\n\n` +
              `• *Follow Boost:*\n.boost follow <Channel_Link> <Qty>\n_උදා: .boost follow https://whatsapp.com/channel/xxx 100_\n\n` +
              `• *React Boost:*\n.boost react <Post_Link> <Emoji> <Qty>\n_උදා: .boost react https://whatsapp.com/channel/xxx/12 ❤️ 50_\n\n` +
              `> මිල ගණන් සහ පැකේජ බැලීමට *.rates* run කරන්න.`
      }, { quoted: msg });
    }

    // ── FOLLOW BOOST ──
    if (type === 'follow') {
      const link = args[1];
      const qty = parseInt(args[2], 10);

      const cost = PRICING.follow[qty];
      if (!link || !cost) {
        return await sock.sendMessage(from, { 
          text: '❌ වලංගු Follow පැකේජයක් තෝරන්න (100, 200, 300, 400).' 
        }, { quoted: msg });
      }

      const userSettings = await getBotSettings(botNum);
      const currentCoins = userSettings.coins || 0;

      if (currentCoins < cost) {
        return await sock.sendMessage(from, {
          text: `❌ *Coins ප්‍රමාණවත් නැත!*\n\n• අවශ්‍ය Coins: *${cost} 🪙*\n• ඔබගේ Balance: *${currentCoins} 🪙*`
        }, { quoted: msg });
      }

      const inviteCode = link.split('channel/')[1]?.split('/')[0]?.replace('/', '');
      if (!inviteCode) {
        return await sock.sendMessage(from, { text: '❌ නිවැරදි Channel Link එකක් ලබාදෙන්න!' }, { quoted: msg });
      }

      // Coins කපා හැරීම
      userSettings.coins -= cost;
      await userSettings.save();
      clearSettingsCache(botNum);

      await sock.sendMessage(from, {
        text: `⏳ *Boost Started!*\n• Package: *${qty} Follows*\n• Charged: *- ${cost} Coins* 🪙\n• Balance: *${userSettings.coins} Coins* 🪙\n\nTask එක සිදුවෙමින් පවතී...`
      }, { quoted: msg });

      const done = await boostChannelFollow(inviteCode, qty);

      if (done === 0) {
        userSettings.coins += cost;
        await userSettings.save();
        clearSettingsCache(botNum);

        return await sock.sendMessage(from, {
          text: `⚠️ *Boost Failed!* Follows ලබාදීමට නොහැකි විය.\n• Refund: *+ ${cost} Coins* ඔබගේ ගිණුමට එකතු කරන ලදී.`
        }, { quoted: msg });
      }

      return await sock.sendMessage(from, {
        text: `✅ *Boost Finished!*\n• සාර්ථක වූ Follows: *${done}/${qty}*\n• වැයවූ Coins: *${cost} 🪙*`
      }, { quoted: msg });
    }

    // ── REACT BOOST ──
    if (type === 'react') {
      const link = args[1];
      const emoji = args[2];
      const qty = parseInt(args[3], 10);

      const cost = PRICING.react[qty];
      if (!link || !emoji || !cost) {
        return await sock.sendMessage(from, { 
          text: '❌ Usage: `.boost react <link> <emoji> <qty>`\n(Packages: 50, 100, 300, 400)' 
        }, { quoted: msg });
      }

      const userSettings = await getBotSettings(botNum);
      const currentCoins = userSettings.coins || 0;

      if (currentCoins < cost) {
        return await sock.sendMessage(from, {
          text: `❌ *Coins ප්‍රමාණවත් නැත!*\n\n• අවශ්‍ය Coins: *${cost} 🪙*\n• ඔබගේ Balance: *${currentCoins} 🪙*`
        }, { quoted: msg });
      }

      const parts = link.split('channel/')[1]?.split('/');
      const inviteCode = parts?.[0];
      const serverId = parts?.[1];

      if (!inviteCode || !serverId) {
        return await sock.sendMessage(from, { text: '❌ Channel Post එකේ Direct URL එක ලබා දෙන්න!' }, { quoted: msg });
      }

      const anySock = Object.values(global.activeSessions || {})[0];
      if (!anySock) return await sock.sendMessage(from, { text: '❌ සක්‍රීය Bots ලා කිසිවෙක් නැත.' });

      const meta = await anySock.newsletterMetadata('invite', inviteCode).catch(() => null);
      if (!meta?.id) return await sock.sendMessage(from, { text: '❌ Channel එක සොයාගත නොහැක.' });

      // Coins කපා හැරීම
      userSettings.coins -= cost;
      await userSettings.save();
      clearSettingsCache(botNum);

      await sock.sendMessage(from, {
        text: `⏳ *Boost Started!*\n• Package: *${qty} Reacts (${emoji})*\n• Charged: *- ${cost} Coins* 🪙\n• Balance: *${userSettings.coins} Coins* 🪙\n\nReacts යැවෙමින් පවතී...`
      }, { quoted: msg });

      const done = await boostChannelReact(meta.id, serverId, emoji, qty);

      if (done === 0) {
        userSettings.coins += cost;
        await userSettings.save();
        clearSettingsCache(botNum);

        return await sock.sendMessage(from, {
          text: `⚠️ *Boost Failed!* Reactions ලබා දීමට නොහැකි විය.\n• Refund: *+ ${cost} Coins* ඔබගේ ගිණුමට නැවත බැර විය.`
        }, { quoted: msg });
      }

      return await sock.sendMessage(from, {
        text: `✅ *React Boost Finished!*\n• සාර්ථක වූ Reacts: *${done}/${qty}*\n• වැයවූ Coins: *${cost} 🪙*`
      }, { quoted: msg });
    }
  }
};
