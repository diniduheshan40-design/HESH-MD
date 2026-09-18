const { delay } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'cpoll',
  alias: ['channelpoll', 'pollvote'],
  category: 'owner',
  desc: 'Vote on WhatsApp Channel polls using all connected bot sessions',

  execute: async (sock, msg, args, chatJid, safeReply, { isOwner }) => {
    // 1. Owner verification
    if (!isOwner) {
      return safeReply('❌ මේ command එක භාවිත කළ හැක්කේ Owner ට පමණි.');
    }

    // 2. Input validation
    const input = args.join(' ');
    if (!input || !input.includes('|')) {
      return safeReply(
        '*✦ CHANNEL POLL BOOSTER ✦*\n\n' +
        'භාවිතය:\n' +
        '`.cpoll <Channel_Link> | <Option_Number_හෝ_Name>`\n\n' +
        '*උදාහරණ:*\n' +
        '`.cpoll https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V/100 | 1`\n' +
        '`.cpoll https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V/100 | Option Name`'
      );
    }

    const [channelLink, optionTarget] = input.split('|').map(s => s.trim());

    // 3. Link එකෙන් Invite Code එක සහ Server/Message ID එක වෙන් කරගැනීම
    const match = channelLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)\/(\d+)/);
    if (!match) {
      return safeReply('❌ වලංගු WhatsApp Channel message link එකක් ඇතුළත් කරන්න.');
    }

    const inviteCode = match[1];
    const serverId = match[2];

    const allSessions = Object.values(global.activeSessions || {});
    if (allSessions.length === 0) {
      return safeReply('❌ දැනට Active sessions කිසිවක් හමු නොවීය.');
    }

    await safeReply(`⏳ Channel data ලබාගනිමින් පවතී... (Active Bots: ${allSessions.length})`);

    try {
      // 4. Newsletter JID එක Resolve කරගැනීම
      const meta = await sock.newsletterMetadata('invite', inviteCode);
      if (!meta || !meta.id) {
        return safeReply('❌ Channel එක සොයාගත නොහැකි විය. Invite code එක පරීක්ෂා කරන්න.');
      }
      const newsletterJid = meta.id;

      // 5. Channel එකෙන් අදාළ Poll Message එක fetch කිරීම
      const messages = await sock.newsletterFetchMessages(newsletterJid, {
        count: 25,
        before: parseInt(serverId) + 1
      });

      const targetMsg = messages.find(m => String(m.server_id) === String(serverId) || String(m.id) === String(serverId));

      if (!targetMsg) {
        return safeReply('❌ ලබාදුන් Link එකට අදාළ Poll Message එක සොයාගත නොහැකි විය.');
      }

      // Poll Message Key එක සකසා ගැනීම
      const pollCreationKey = {
        remoteJid: newsletterJid,
        id: targetMsg.id,
        fromMe: false
      };

      // Poll options හඳුනාගැනීම (Option index එකක් දුන්නොත් string name එකට හැරවීම)
      const pollData = targetMsg.message?.pollCreationMessage || targetMsg.message?.pollCreationMessageV2 || targetMsg.message?.pollCreationMessageV3;
      let finalVoteValue = optionTarget;

      if (pollData && pollData.options) {
        const optIndex = parseInt(optionTarget) - 1;
        if (!isNaN(optIndex) && pollData.options[optIndex]) {
          finalVoteValue = pollData.options[optIndex].optionName;
        }
      }

      await safeReply(`🚀 *Voting ආරම්භ කළා!*\nTarget: "${finalVoteValue}" වෙත votes යැවීම සිදුවේ...`);

      let successCount = 0;
      let failCount = 0;

      // 6. සියලුම Bot Sessions හරහා Poll එකට Vote කිරීම
      for (const botSock of allSessions) {
        try {
          // Channel එක follow කර නොමැති නම් follow කිරීම
          try {
            await botSock.newsletterFollow(newsletterJid);
          } catch (e) {}

          // Vote payload එක යැවීම
          await botSock.sendMessage(newsletterJid, {
            pollVote: {
              pollCreationMessageKey: pollCreationKey,
              votes: [finalVoteValue]
            }
          });

          successCount++;
          // Rate limit වැළැක්වීමට තත්පර 3 ක delay එකක්
          await delay(3000);
        } catch (err) {
          failCount++;
        }
      }

      return safeReply(
        `*✦ POLL VOTE RESULTS ✦*\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *Option*      : ${finalVoteValue}\n` +
        `• *සාර්ථකයි*    : ${successCount}\n` +
        `• *අසාර්ථකයි*  : ${failCount}\n` +
        `• *Total Bots*  : ${allSessions.length}\n` +
        `━━━━━━━━━━━━━━━━━━━━━`
      );

    } catch (error) {
      return safeReply(`❌ දෝෂයක් මතු විය: ${error.message}`);
    }
  }
};

