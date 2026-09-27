// commands/cfollow.js
const { delay, jidNormalizedUser } = require('@whiskeysockets/baileys');

// 👑 EXCLUSIVE DEVELOPER NUMBER
const DEVELOPER_NUMBER = '94719845166';

// Channel Link එකෙන් Invite Code එක ලබා ගැනීම
function extractChannelInviteCode(link) {
  if (!link) return null;
  const match = link.match(/(?:whatsapp\.com\/channel\/)([a-zA-Z0-9]{20,26})/i);
  return match ? match[1] : null;
}

module.exports = {
  name: 'cfollow',
  alias: ['channelfollow', 'autofollow'],
  category: 'developer',
  desc: 'Follow a WhatsApp channel from all active bot sessions (Developer Only)',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
    };

    // ⚡ 1. SENDER VERIFICATION (Group / Private / LID Support)
    const isGroup = targetChat.endsWith('@g.us');
    let senderJid = isGroup 
      ? (msg.key?.participant || msg.participant || '') 
      : (msg.key?.fromMe ? (sock.user?.id || '') : targetChat);

    if (senderJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
      try {
        const resolved = await sock.signalRepository.lidToJid(senderJid);
        if (resolved) senderJid = resolved;
      } catch (e) {}
    }

    const cleanSenderNum = jidNormalizedUser(senderJid).replace(/\D/g, '');

    // ⛔ 2. STRICT DEVELOPER CHECK (+94719845166 ට පමණි)
    if (cleanSenderNum !== DEVELOPER_NUMBER) {
      return await reply('⛔ *Access Denied!* මෙම Command එක භාවිත කළ හැක්කේ ප්‍රධාන Developer හට පමණි (+94719845166).');
    }

    // ⚡ 3. INPUT VALIDATION
    let fullText = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();
    if (!fullText) {
      const msgRaw = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      fullText = msgRaw.replace(/^[./!#]?(cfollow|channelfollow|autofollow)[,\s]*/i, '').trim();
    }

    const inviteCode = extractChannelInviteCode(fullText);

    if (!inviteCode) {
      return await reply(
        `╭───❮ 📢 *AUTO CHANNEL FOLLOWER* ❯───╮\n` +
        `│\n` +
        `│ ⚠️ *කරුණාකර නිවැරදි Channel Link එකක් ලබාදෙන්න!*\n` +
        `│ 💡 *උදාහරණ:* \`.cfollow https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V\`\n` +
        `│\n` +
        `╰─────────────────────────────────────╯\n` +
        `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ⚡`
      );
    }

    sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    // ⚡ 4. FILTER REAL LIVE SESSIONS
    const activeSessions = global.activeSessions || {};
    const sessionNumbers = Object.keys(activeSessions);

    const liveBots = sessionNumbers.filter(num => {
      const s = activeSessions[num];
      return Boolean(s && (s.ws?.readyState === 1 || s.ws?.socket?.readyState === 1) && s.user?.id);
    });

    if (liveBots.length === 0) {
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await reply('❌ Follow කිරීමට සක්‍රීය (Live) Sessions කිසිවක් හමු නොවීය!');
    }

    let progressMsg = await sock.sendMessage(targetChat, {
      text: `🔄 *Channel Follow ආරම්භ විය...*\n\n• 🎯 Channel Code : \`${inviteCode}\`\n• 🤖 Live Active Bots : *${liveBots.length} Bots*\n\n> කරුණාකර සුළු වේලාවක් රැඳී සිටින්න... ⏳`,
      ...(global.channelContext || {})
    }, { quoted: msg }).catch(() => null);

    let successCount = 0;
    let failedCount = 0;
    let channelTitle = 'WhatsApp Channel';

    // ⚡ 5. SAFE EXECUTION LOOP
    for (let i = 0; i < liveBots.length; i++) {
      const botNum = liveBots[i];
      const currentSock = activeSessions[botNum];

      if (!currentSock) {
        failedCount++;
        continue;
      }

      try {
        if (typeof currentSock.newsletterMetadata === 'function' && typeof currentSock.newsletterFollow === 'function') {
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

      // Flood Protection Delay (තත්පර 2 සිට 3.5 දක්වා)
      const randomWait = Math.floor(Math.random() * 1500) + 2000;
      await delay(randomWait);
    }

    if (progressMsg?.key) {
      await sock.sendMessage(targetChat, { delete: progressMsg.key }).catch(() => {});
    }

    // ⚡ 6. REPORT CARD
    const reportCard = 
      `╭──────❮ ✨ *CHANNEL FOLLOW REPORT* ✨ ❯──────╮\n` +
      `│\n` +
      `├ 📢 *Channel Name :* ${channelTitle}\n` +
      `├ 🔗 *Invite Code  :* ${inviteCode}\n` +
      `│\n` +
      `├ 🤖 *Target Bots  :* ${liveBots.length}\n` +
      `├ ✅ *Successful   :* ${successCount} Bots\n` +
      `├ ❌ *Failed       :* ${failedCount} Bots\n` +
      `│\n` +
      `├ 🛡️ *Throttle     :* 2.5s Random Delay\n` +
      `├ 👑 *Developer    :* +${DEVELOPER_NUMBER}\n` +
      `│\n` +
      `╰─────────────────────────────────────────────╯\n` +
      `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ⚡`;

    await reply(reportCard);
    sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
  }
};
