const { delay } = require('@whiskeysockets/baileys');
const crypto = require('crypto');

module.exports = {
  name: 'cpoll',
  alias: ['channelpoll', 'pollvote'],
  category: 'owner',
  desc: 'Vote on WhatsApp Channel polls using all connected bot sessions',

  execute: async (sock, msg, args, chatJid, safeReply, { isOwner }) => {
    if (!isOwner) {
      return safeReply('❌ මේ command එක භාවිත කළ හැක්කේ Owner ට පමණි.');
    }

    const rawText = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || 
                    args.join(' ');

    const cleanText = rawText.replace(/^[./!#]cpoll\s*/i, '').trim();
    const parts = cleanText.split(',').map(p => p.trim()).filter(Boolean);

    if (parts.length < 2) {
      return safeReply(
        '*✦ CHANNEL POLL BOOSTER ✦*\n\n' +
        '📌 *භාවිතය:*\n' +
        '`.cpoll , <Channel_Link> , <Option_Text>`\n\n' +
        '💡 *උදාහරණ:*\n' +
        '`.cpoll , https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V/182 , 😁`'
      );
    }

    const channelLink = parts[0];
    const optionTarget = parts.slice(1).join(',').trim();

    const match = channelLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)\/(\d+)/);
    if (!match) {
      return safeReply('❌ වලංගු WhatsApp Channel message link එකක් නොවේ.');
    }

    const inviteCode = match[1];
    const serverId = match[2];

    const allSessions = Object.values(global.activeSessions || {});
    if (allSessions.length === 0) {
      return safeReply('❌ Active bot sessions කිසිවක් හමු නොවීය.');
    }

    await safeReply(`⏳ Channel data ලබාගනිමින්... (Active Bots: ${allSessions.length})`);

    try {
      // 1. Channel JID ලබාගැනීම
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
        return safeReply('❌ Channel එක සොයාගත නොහැකි විය.');
      }

      await safeReply(`🚀 *Voting ආරම්භ කළා!*\n🎯 Channel: ${newsletterJid}\n🎯 Option: "${optionTarget}"`);

      // Option එක Hash කරගැනීම (Channel Poll වලට SHA-256 hash එක අවශ්‍ය වේ)
      const optionHash = crypto.createHash('sha256').update(optionTarget.trim()).digest('hex');

      let successCount = 0;
      let failCount = 0;

      // 2. Bots ලා ඔක්කොම හරහා Channel Query එකක් ලෙස Vote එක යැවීම
      for (const botSock of allSessions) {
        try {
          // Channel එක auto-follow කිරීම
          try {
            if (typeof botSock.newsletterFollow === 'function') {
              await botSock.newsletterFollow(newsletterJid);
            }
          } catch (e) {}

          // Protocol Method 1: Newsletter Action IQ Query
          let voted = false;
          try {
            await botSock.query({
              tag: 'message',
              attrs: {
                to: newsletterJid,
                type: 'poll',
                id: botSock.generateMessageTag ? botSock.generateMessageTag() : `${Date.now()}`
              },
              content: [{
                tag: 'poll_vote',
                attrs: {
                  server_id: serverId,
                  option: optionHash
                }
              }]
            });
            voted = true;
          } catch (iqErr) {
            // IQ fail වුණොත් fallback payload එක
            await botSock.relayMessage(newsletterJid, {
              pollUpdateMessage: {
                pollCreationMessageKey: {
                  remoteJid: newsletterJid,
                  id: serverId,
                  fromMe: false
                },
                vote: {
                  selectedOptions: [Buffer.from(optionHash, 'hex')]
                },
                senderTimestampMs: Date.now()
              }
            }, {});
            voted = true;
          }

          if (voted) successCount++;
          await delay(2500);
        } catch (err) {
          failCount++;
        }
      }

      return safeReply(
        `*✦ VOTE SUMMARY ✦*\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *Option*      : ${optionTarget}\n` +
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

