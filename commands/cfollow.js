// commands/cfollow.js
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const EXCLUSIVE_OWNER = '94719845166';

// ⚡ Channel Link එකෙන් Invite Code එක Extract කරන Helper
function extractChannelInviteCode(link) {
  if (!link) return null;
  const match = link.match(/(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([a-zA-Z0-9]{20,26})/i);
  return match ? match[1] : null;
}

module.exports = {
  name: 'cfollow',
  alias: ['channelfollow', 'autofollow'],
  category: 'owner',
  desc: 'Follow a WhatsApp channel from all active bot sessions slowly',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // ⚡ 1. STRICT OWNER VERIFICATION (94719845166 ONLY)
    const sender = (msg.key.participant || targetChat || '').replace(/[^0-9]/g, '');
    const isMasterOwner = sender.includes(EXCLUSIVE_OWNER) || msg.key.fromMe && (sock.user?.id || '').includes(EXCLUSIVE_OWNER);

    if (!isMasterOwner) {
      return await sock.sendMessage(targetChat, { 
        text: '⛔ *Access Denied!* මෙම Command එක භාවිතා කළ හැක්කේ ප්‍රධාන හිමිකරුට (Master Owner) පමණි.' 
      }, { quoted: msg });
    }

    // ⚡ 2. INPUT VALIDATION
    const inputUrl = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();
    const inviteCode = extractChannelInviteCode(inputUrl);

    if (!inviteCode) {
      return await sock.sendMessage(targetChat, {
        text: `╭───❮ 📢 *AUTO CHANNEL FOLLOWER* ❯───╮
│
│ ⚠️ *කරුණාකර නිවැරදි Channel Link එකක් ලබාදෙන්න!*
│ 💡 *උදාහරණ:* \`.cfollow https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V\`
│
╰─────────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`
      }, { quoted: msg });
    }

    // Reaction
    sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    // ⚡ 3. GATHER ALL ACTIVE SESSIONS
    const activeSessions = global.activeSessions || {};
    const sessionNumbers = Object.keys(activeSessions);

    if (sessionNumbers.length === 0) {
      return await sock.sendMessage(targetChat, { 
        text: '❌ Active Sessions කිසිවක් හමු නොවීය!' 
      }, { quoted: msg });
    }

    let progressMsg = await sock.sendMessage(targetChat, {
      text: `🔄 *Channel Follow ආරම්භ විය...*\n\n• 🎯 Channel Code : \`${inviteCode}\`\n• 🤖 Target Bots : *${sessionNumbers.length} Bots*\n\n> කරුණාකර සුළු වේලාවක් රැඳී සිටින්න... ⏳`
    }, { quoted: msg }).catch(() => null);

    let successCount = 0;
    let failedCount = 0;
    let channelTitle = 'WhatsApp Channel';

    // ⚡ 4. LOOP & SLOWLY FOLLOW
    for (let i = 0; i < sessionNumbers.length; i++) {
      const botNum = sessionNumbers[i];
      const currentSock = activeSessions[botNum];

      if (!currentSock || typeof currentSock.newsletterFollow !== 'function') {
        failedCount++;
        continue;
      }

      try {
        // Channel Metadata ලබාගැනීම
        if (typeof currentSock.newsletterMetadata === 'function') {
          const meta = await currentSock.newsletterMetadata('invite', inviteCode).catch(() => null);
          if (meta?.id) {
            channelTitle = meta.name || channelTitle;
            await currentSock.newsletterFollow(meta.id);
            successCount++;
          } else {
            failedCount++;
          }
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
      }

      // Safe Delay (තත්පර 2 සිට 3.5 දක්වා Random Delay එකක් - Spam Protect)
      const randomWait = Math.floor(Math.random() * 1500) + 2000;
      await delay(randomWait);
    }

    // Step 5: Delete Waiting Message
    if (progressMsg?.key) {
      await sock.sendMessage(targetChat, { delete: progressMsg.key }).catch(() => {});
    }

    // Step 6: Luxury Report Card
    const reportCard = `╭──────❮ ✨ *CHANNEL FOLLOW REPORT* ✨ ❯──────╮
│
├ 📢 *Channel Name :* ${channelTitle}
├ 🔗 *Invite Code  :* ${inviteCode}
│
├ 🤖 *Total Bots   :* ${sessionNumbers.length}
├ ✅ *Successful   :* ${successCount} Bots
├ ❌ *Failed       :* ${failedCount} Bots
│
├ 🛡️ *Safety Delay :* 2.5s Auto Throttle
├ 👑 *Executed By  :* Master Owner (+${EXCLUSIVE_OWNER})
│
╰─────────────────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

    await sock.sendMessage(targetChat, {
      text: reportCard,
      contextInfo: global.channelContext?.contextInfo || {}
    }, { quoted: msg });

    sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
  }
};

