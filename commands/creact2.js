const { delay } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'creact',
  alias: ['channelreact', 'creaction'],
  category: 'owner',
  desc: 'React to a WhatsApp Channel post using all active bot sessions',

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
        '*✦ CHANNEL REACTION BOOSTER ✦*\n\n' +
        '📌 *භාවිතය:*\n' +
        '`.creact <Channel_Link> , <Emoji>`\n\n' +
        '💡 *උදාහරණ:*\n' +
        '`.creact https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V/182 , ❤️`\n' +
        '`.creact https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V/182 , 🔥`'
      );
    }

    const inviteCode = linkMatch[1];
    const serverId = linkMatch[2];

    const afterLink = rawText.substring(rawText.indexOf(linkMatch[0]) + linkMatch[0].length);
    const targetEmoji = afterLink.replace(/^[,\s|]+/, '').trim();

    if (!targetEmoji) {
      return safeReply('❌ කරුණාකර React කිරීමට අවශ්‍ය Emoji එක ඇතුළත් කරන්න (e.g. ❤️, 🔥, 👍).');
    }

    const allSessions = Object.values(global.activeSessions || {});
    if (allSessions.length === 0) {
      return safeReply('❌ Active bot sessions කිසිවක් හමු නොවීය.');
    }

    await safeReply(`⏳ Channel data පරීක්ෂා කරමින්... (Active Bots: ${allSessions.length})`);

    try {
      // 1. Newsletter JID එක Resolve කරගැනීම
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

      await safeReply(`🚀 *Reaction Boost ආරම්භ කළා!*\n🎯 Emoji: ${targetEmoji} | Bots: ${allSessions.length}`);

      let successCount = 0;
      let failCount = 0;

      // 2. Active bots ලා සියලුදෙනා හරහා Reaction යැවීම
      for (const botSock of allSessions) {
        try {
          // Channel එක auto-follow කිරීම
          try {
            if (typeof botSock.newsletterFollow === 'function') {
              await botSock.newsletterFollow(newsletterJid);
            }
          } catch (e) {}

          // Method A: Native newsletterReactMessage helper
          if (typeof botSock.newsletterReactMessage === 'function') {
            await botSock.newsletterReactMessage(newsletterJid, serverId, targetEmoji);
          } else {
            // Method B: Binary reaction payload
            await botSock.sendMessage(newsletterJid, {
              react: {
                text: targetEmoji,
                key: {
                  remoteJid: newsletterJid,
                  server_id: serverId,
                  id: serverId,
                  fromMe: false
                }
              }
            });
          }

          successCount++;
          await delay(1500); // Flood detection වැළැක්වීමට පොඩි delay එකක්
        } catch (err) {
          failCount++;
        }
      }

      return safeReply(
        `*✦ REACTION SUMMARY ✦*\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *Emoji*       : ${targetEmoji}\n` +
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

