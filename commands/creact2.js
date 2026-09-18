const { delay } = require('@whiskeysockets/baileys');

// Default Random Emojis list
const DEFAULT_REACTIONS = ['💗', '❤️', '🥰', '😯', '🔥', '✨', '👍', '🪄'];

module.exports = {
  name: 'creact',
  alias: ['channelreact', 'creaction'],
  category: 'owner',
  desc: 'React with random emojis to a WhatsApp Channel post using all active bots',

  execute: async (sock, msg, args, chatJid, safeReply, { isOwner }) => {
    if (!isOwner) {
      return safeReply('❌ මේ command එක භාවිත කළ හැක්කේ Owner ට පමණි.');
    }

    const rawText = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || 
                    args.join(' ');

    const linkMatch = rawText.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)\/(\d+)/);
    if (!linkMatch) {
      return safeReply(
        '*✦ RANDOM CHANNEL REACTION BOOSTER ✦*\n\n' +
        '📌 *භාවිතය:*\n' +
        '1. Default Random Emojis:\n' +
        '`.creact <Channel_Link>`\n\n' +
        '2. Custom Random Emojis:\n' +
        '`.creact <Channel_Link> , 💗,❤️,🥰,😯`'
      );
    }

    const inviteCode = linkMatch[1];
    const serverId = linkMatch[2];

    // Emojis වෙන් කරගැනීම
    const afterLink = rawText.substring(rawText.indexOf(linkMatch[0]) + linkMatch[0].length);
    const cleanEmojis = afterLink.replace(/^[,\s|]+/, '').trim();

    let emojiPool = DEFAULT_REACTIONS;
    if (cleanEmojis) {
      const customPool = cleanEmojis.split(',').map(e => e.trim()).filter(Boolean);
      if (customPool.length > 0) emojiPool = customPool;
    }

    let allSessions = Object.values(global.activeSessions || {});
    if (allSessions.length === 0) {
      allSessions = [sock];
    }

    await safeReply(`⏳ Channel data පරීක්ෂා කරමින්... (Active Bots: ${allSessions.length})`);

    try {
      let newsletterJid = null;
      if (typeof sock.newsletterMetadata === 'function') {
        const meta = await sock.newsletterMetadata('invite', inviteCode).catch(() => null);
        newsletterJid = meta?.id;
      }

      if (!newsletterJid) {
        const result = await sock.query({
          tag: 'iq',
          attrs: { to: 's.whatsapp.net', xmlns: 'w:mex', type: 'get' },
          content: [{
            tag: 'query',
            attrs: { query_id: '6620195908089573' },
            content: Buffer.from(JSON.stringify({
              variables: { input: { key: inviteCode, type: 'INVITE' } }
            }))
          }]
        }).catch(() => null);

        if (result) {
          const rawData = result.content?.[0]?.content?.toString();
          if (rawData) {
            try {
              const parsed = JSON.parse(rawData);
              newsletterJid = parsed?.data?.xwa2_newsletter?.id;
            } catch (e) {}
          }
        }
      }

      if (!newsletterJid) {
        return safeReply('❌ Channel එක සොයාගත නොහැකි විය. Link එක පරීක්ෂා කරන්න.');
      }

      await safeReply(`🚀 *Random Reactions Boost ආරම්භ කළා!*\n🎯 Pool: [ ${emojiPool.join(' ')} ]\n🎯 Bots: ${allSessions.length}`);

      let successCount = 0;
      let failCount = 0;
      const usedEmojis = [];

      for (const botSock of allSessions) {
        try {
          try {
            if (typeof botSock.newsletterFollow === 'function') {
              await botSock.newsletterFollow(newsletterJid);
            }
          } catch (e) {}

          // සෑම bot කෙනෙකුටම අහඹු (Random) emoji එකක් තෝරා ගැනීම
          const randomEmoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];

          if (typeof botSock.newsletterReactMessage === 'function') {
            await botSock.newsletterReactMessage(newsletterJid, serverId, randomEmoji);
          } else {
            await botSock.sendMessage(newsletterJid, {
              react: {
                text: randomEmoji,
                key: {
                  remoteJid: newsletterJid,
                  server_id: serverId,
                  id: serverId,
                  fromMe: false
                }
              }
            });
          }

          usedEmojis.push(randomEmoji);
          successCount++;
          await delay(1500); // Flood detection වැළැක්වීමට
        } catch (err) {
          failCount++;
        }
      }

      return safeReply(
        `*✦ REACTION SUMMARY ✦*\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *Reactions*   : ${usedEmojis.join(' ')}\n` +
        `• *සාර්ථකයි*    : ${successCount}\n` +
        `• *අසාර්ථකයි*  : ${failCount}\n` +
        `• *මුළු Bots*  : ${allSessions.length}\n` +
        `━━━━━━━━━━━━━━━━━━━━━`
      );

    } catch (error) {
      return safeReply(`❌ දෝෂයක් මතු විය: ${error.message}`);
    }
  }
};

