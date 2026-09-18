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

    await safeReply(`⏳ Channel data පරීක්ෂා කරමින්... (Active Bots: ${allSessions.length})`);

    try {
      // 1. Channel JID එක ලබාගැනීම
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
        return safeReply('❌ Channel එක සොයාගත නොහැකි විය. Invite code එක පරීක්ෂා කරන්න.');
      }

      // 2. Channel එකෙන් Poll Message එක සහ එහි Hash Keys ලබාගැනීම
      let targetMsg = null;
      if (typeof sock.newsletterFetchMessages === 'function') {
        try {
          const fetched = await sock.newsletterFetchMessages(newsletterJid, { count: 30 });
          if (Array.isArray(fetched)) {
            targetMsg = fetched.find(m => String(m.server_id) === String(serverId) || String(m.id) === String(serverId));
          }
        } catch (e) {}
      }

      // Poll Creation Key සකස් කිරීම
      const msgId = targetMsg?.id || serverId;
      const pollCreationKey = {
        remoteJid: newsletterJid,
        id: msgId,
        fromMe: false
      };

      // Option Name හඳුනාගැනීම සහ SHA256 Hash එක හැදීම
      let optionName = optionTarget;
      const pollData = targetMsg?.message?.pollCreationMessage || 
                      targetMsg?.message?.pollCreationMessageV2 || 
                      targetMsg?.message?.pollCreationMessageV3;

      if (pollData && pollData.options) {
        const optNum = parseInt(optionTarget) - 1;
        if (!isNaN(optNum) && pollData.options[optNum]) {
          optionName = pollData.options[optNum].optionName;
        }
      }

      const optionHashHex = crypto.createHash('sha256').update(optionName.trim()).digest('hex');
      const optionHashBuffer = Buffer.from(optionHashHex, 'hex');

      await safeReply(`🚀 *Voting ආරම්භ කළා!*\n🎯 Option: "${optionName}" වෙත active bots ලාගෙන් vote යවමින් පවතී...`);

      let successCount = 0;
      let failCount = 0;

      // 3. සියලුම Bots ලාගෙන් Vote එක Relay කිරීම
      for (const botSock of allSessions) {
        try {
          // Channel එක Follow කර නැත්නම් Follow කරවීම
          try {
            if (typeof botSock.newsletterFollow === 'function') {
              await botSock.newsletterFollow(newsletterJid);
            }
          } catch (e) {}

          let hasVoted = false;

          // ක්‍රමය A: WhatsApp Native PollUpdateMessage Relay (වඩාත්ම සාර්ථක ක්‍රමය)
          try {
            await botSock.relayMessage(newsletterJid, {
              pollUpdateMessage: {
                pollCreationMessageKey: pollCreationKey,
                vote: {
                  selectedOptions: [optionHashBuffer]
                },
                senderTimestampMs: Date.now()
              }
            }, { messageId: botSock.generateMessageTag ? botSock.generateMessageTag() : `${Date.now()}` });
            hasVoted = true;
          } catch (errA) {
            // ක්‍රමය B: Standard PollVote Fallback
            try {
              await botSock.sendMessage(newsletterJid, {
                pollVote: {
                  pollCreationMessageKey: pollCreationKey,
                  votes: [optionName]
                }
              });
              hasVoted = true;
            } catch (errB) {}
          }

          if (hasVoted) {
            successCount++;
          } else {
            failCount++;
          }

          // Spam filters වලට අහු නොවෙන්න තත්පර 2 ක delay එකක්
          await delay(2000);
        } catch (err) {
          failCount++;
        }
      }

      return safeReply(
        `*✦ VOTE SUMMARY ✦*\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *Target*      : ${optionName}\n` +
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

