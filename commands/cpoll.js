const { delay } = require('@whiskeysockets/baileys');
const crypto = require('crypto');

module.exports = {
  name: 'cpoll',
  alias: ['channelpoll', 'pollvote'],
  category: 'owner',
  desc: 'Vote on WhatsApp Channel polls using all connected bot sessions',

  execute: async (sock, msg, args, chatJid, safeReply, { isOwner }) => {
    // 1. Owner check
    if (!isOwner) {
      return safeReply('❌ මේ command එක භාවිත කළ හැක්කේ Owner ට පමණි.');
    }

    // Message එක සම්පූර්ණයෙන්ම ලබා ගැනීම
    const rawText = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || 
                    args.join(' ');

    // Command prefix එක අයින් කරගැනීම
    const cleanText = rawText.replace(/^[./!#]cpoll\s*/i, '').trim();

    // කොමා (,) වලින් split කරගැනීම
    // Format: .cpoll , link , option
    const parts = cleanText.split(',').map(p => p.trim()).filter(Boolean);

    if (parts.length < 2) {
      return safeReply(
        '*✦ CHANNEL POLL BOOSTER ✦*\n\n' +
        '📌 *භාවිතය:*\n' +
        '`.cpoll , <Channel_Link> , <Option_Number_හෝ_Name>`\n\n' +
        '💡 *උදාහරණ:*\n' +
        '`.cpoll , https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V/181 , 1`\n' +
        '`.cpoll , https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V/181 , Yes`'
      );
    }

    const channelLink = parts[0];
    const optionTarget = parts.slice(1).join(',').trim(); // Option එක ඇතුළේ කොමා තිබුණත් handle වෙන්න

    // Link එකෙන් Invite Code එක සහ Message Server ID එක වෙන් කරගැනීම
    const match = channelLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)\/(\d+)/);
    if (!match) {
      return safeReply('❌ කරුණාකර නිවැරදි Channel message link එකක් ලබාදෙන්න.');
    }

    const inviteCode = match[1];
    const serverId = match[2];

    const allSessions = Object.values(global.activeSessions || {});
    if (allSessions.length === 0) {
      return safeReply('❌ Active bot sessions කිසිවක් හමු නොවීය.');
    }

    await safeReply(`⏳ Channel data පරීක්ෂා කරමින්... (Active Bots: ${allSessions.length})`);

    try {
      // Newsletter JID එක Resolve කිරීම
      const meta = await sock.newsletterMetadata('invite', inviteCode);
      if (!meta || !meta.id) {
        return safeReply('❌ Channel එක සොයාගත නොහැකි විය. Link එක පරීක්ෂා කරන්න.');
      }
      const newsletterJid = meta.id;

      // Channel messages fetch කිරීම
      let targetMsg = null;
      try {
        const messages = await sock.newsletterFetchMessages(newsletterJid, {
          count: 50
        });

        if (Array.isArray(messages)) {
          targetMsg = messages.find(m => 
            String(m.server_id) === String(serverId) || 
            String(m.id) === String(serverId) ||
            String(m.key?.id) === String(serverId) ||
            String(m.key?.server_id) === String(serverId)
          );
        }
      } catch (fetchErr) {
        console.log('Fetch error fallback');
      }

      const messageId = targetMsg?.id || targetMsg?.key?.id || serverId;
      const pollCreationKey = {
        remoteJid: newsletterJid,
        id: messageId,
        fromMe: false
      };

      // Option එක අංකයක් නම් අදාළ Text එක ලබාගැනීම
      let selectedOptionName = optionTarget;
      const pollMsg = targetMsg?.message?.pollCreationMessage || 
                      targetMsg?.message?.pollCreationMessageV2 || 
                      targetMsg?.message?.pollCreationMessageV3;

      if (pollMsg && pollMsg.options) {
        const optNum = parseInt(optionTarget) - 1;
        if (!isNaN(optNum) && pollMsg.options[optNum]) {
          selectedOptionName = pollMsg.options[optNum].optionName;
        }
      }

      const optionHash = crypto.createHash('sha256').update(selectedOptionName).digest('hex');

      await safeReply(`🚀 *Voting ආරම්භ කළා!*\n🎯 ඉලක්කය: "${selectedOptionName}"`);

      let successCount = 0;
      let failCount = 0;

      for (const botSock of allSessions) {
        try {
          // Channel එක follow කර නොමැති නම් auto-follow කිරීම
          try {
            await botSock.newsletterFollow(newsletterJid);
          } catch (e) {}

          // Vote payload එක යැවීම
          try {
            await botSock.sendMessage(newsletterJid, {
              pollVote: {
                pollCreationMessageKey: pollCreationKey,
                votes: [selectedOptionName]
              }
            });
          } catch (vErr) {
            await botSock.sendMessage(newsletterJid, {
              pollVote: {
                pollCreationMessageKey: pollCreationKey,
                votes: [optionHash]
              }
            });
          }

          successCount++;
          await delay(2500); // Rate limit වැළැක්වීමට
        } catch (err) {
          console.error(`Vote error on ${botSock.user?.id}:`, err.message);
          failCount++;
        }
      }

      return safeReply(
        `*✦ VOTE SUMMARY ✦*\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *Option*      : ${selectedOptionName}\n` +
        `• *සාර්ථකයි*    : ${successCount}\n` +
        `• *අසාර්ථකයි*  : ${failCount}\n` +
        `• *මුළු Bots*  : ${allSessions.length}\n` +
        `━━━━━━━━━━━━━━━━━━━━━`
      );

    } catch (error) {
      console.error('cpoll error:', error);
      return safeReply(`❌ දෝෂයක් මතු විය: ${error.message}`);
    }
  }
};

