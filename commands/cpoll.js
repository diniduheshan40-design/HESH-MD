const { delay } = require('@whiskeysockets/baileys');
const crypto = require('crypto');

module.exports = {
  name: 'cpoll',
  alias: ['channelpoll', 'pollvote'],
  category: 'owner',
  desc: 'Vote on WhatsApp Channel polls',

  execute: async (sock, msg, args, chatJid, safeReply, { isOwner }) => {
    if (!isOwner) return safeReply('❌ Owner only command!');

    const rawText = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || 
                    args.join(' ');

    // 1. Link එක සහ Message ID එක Extract කිරීම (Regex එකෙන්ම ගන්නවා)
    const linkMatch = rawText.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)\/(\d+)/);
    if (!linkMatch) {
      return safeReply('❌ Link එක වැරදියි! Channel poll message එකේ link එක හරියට එවන්න.');
    }

    const inviteCode = linkMatch[1];
    const serverId = linkMatch[2];

    // 2. Option එක හොයාගැනීම (Link එකෙන් පස්සේ තියෙන ඕනෑම text එකක්/emoji එකක්)
    const afterLink = rawText.substring(rawText.indexOf(linkMatch[0]) + linkMatch[0].length);
    const targetOption = afterLink.replace(/^[,\s|]+/, '').trim();

    if (!targetOption) {
      return safeReply('❌ Vote කරන්න ඕන Option එක (Emoji හෝ Text) ලබාදී නැත!');
    }

    const allSessions = Object.values(global.activeSessions || {});
    if (allSessions.length === 0) {
      return safeReply('❌ Active bots ලා කිසිවෙක් නෑ.');
    }

    await safeReply(`⏳ Channel data පරීක්ෂා කරමින්... (Bots: ${allSessions.length})`);

    try {
      // Channel JID එක සොයා ගැනීම
      let newsletterJid = null;
      try {
        const meta = await sock.newsletterMetadata('invite', inviteCode);
        newsletterJid = meta?.id;
      } catch (e) {
        // Fallback Query
        const q = await sock.query({
          tag: 'iq',
          attrs: { to: 's.whatsapp.net', xmlns: 'w:mex', type: 'get' },
          content: [{
            tag: 'query',
            attrs: { query_id: '6620195908089573' },
            content: Buffer.from(JSON.stringify({ variables: { input: { key: inviteCode, type: 'INVITE' } } }))
          }]
        });
        const parsed = JSON.parse(q.content[0].content.toString());
        newsletterJid = parsed?.data?.xwa2_newsletter?.id;
      }

      if (!newsletterJid) return safeReply('❌ Channel එක සොයාගත නොහැකි විය.');

      // Option එකට අදාළ SHA256 Hash එක හැදීම
      const optionHash = crypto.createHash('sha256').update(targetOption).digest('hex');

      await safeReply(`🚀 *Voting ආරම්භ කළා!*\n🎯 Option: "${targetOption}"`);

      let success = 0;
      let fail = 0;

      for (const botSock of allSessions) {
        try {
          // Channel එක auto follow කරවීම
          try { await botSock.newsletterFollow(newsletterJid); } catch(e){}

          // WhatsApp Channel Native Poll Vote Binary Node
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

          success++;
          await delay(2000);
        } catch (err) {
          // Alternative MEX node fallback
          try {
            await botSock.query({
              tag: 'iq',
              attrs: { to: newsletterJid, type: 'set', xmlns: 'newsletter' },
              content: [{
                tag: 'vote',
                attrs: { server_id: serverId, option: optionHash }
              }]
            });
            success++;
            await delay(2000);
          } catch (e2) {
            fail++;
          }
        }
      }

      return safeReply(
        `*✦ VOTE RESULT ✦*\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *Option*     : ${targetOption}\n` +
        `• *සාර්ථකයි*   : ${success}\n` +
        `• *අසාර්ථකයි* : ${fail}\n` +
        `━━━━━━━━━━━━━━━━━━━━━`
      );

    } catch (err) {
      return safeReply(`❌ දෝෂය: ${err.message}`);
    }
  }
};

