// commands/bots.js
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// 👑 EXCLUSIVE DEVELOPER NUMBER (මෙම අංකයට පමණක් අවසර ඇත)
const DEVELOPER_NUMBER = '94719845166';

module.exports = {
  name: 'bots',
  alias: ['activebots', 'sessions', 'botlist'],
  category: 'developer',
  desc: 'View real active and live connected bot sessions (Developer Only)',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
    };

    // ⚡ 1. SENDER RESOLVER (Group / Private / LID support)
    const isGroup = targetChat.endsWith('@g.us');
    let senderJid = isGroup 
      ? (msg.key?.participant || msg.participant || '') 
      : (msg.key?.fromMe ? (sock.user?.id || '') : targetChat);

    // LID නම් Real JID එකට Decode කිරීම
    if (senderJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
      try {
        const resolved = await sock.signalRepository.lidToJid(senderJid);
        if (resolved) senderJid = resolved;
      } catch (e) {}
    }

    const cleanSenderNum = jidNormalizedUser(senderJid).replace(/\D/g, '');

    // ⛔ 2. STRICT DEVELOPER CHECK
    // Bot run කරන කෙනාටවත් (fromMe) වැඩ කරන්නේ නැත. ඔයාගේ නම්බර් එකට පමණි!
    if (cleanSenderNum !== DEVELOPER_NUMBER) {
      return await reply('⛔ *Access Denied!* මෙම Command එක භාවිත කළ හැක්කේ ප්‍රධාන Developer හට පමණි (+94719845166).');
    }

    sock.sendMessage(targetChat, { react: { text: "🔍", key: msg.key } }).catch(() => {});

    // ⚡ 3. LIVE SESSIONS SCANNER
    const activeSessions = global.activeSessions || {};
    const allSessionKeys = Object.keys(activeSessions);

    const liveBots = [];
    const deadBots = [];

    for (const num of allSessionKeys) {
      const s = activeSessions[num];
      // WebSocket readyState === 1 (OPEN) සහ Authenticated User Session එකක්ද යන්න තහවුරු කිරීම
      const isWsOpen = s?.ws?.readyState === 1 || s?.ws?.socket?.readyState === 1;
      const isUserLoaded = Boolean(s?.user?.id);

      if (s && isWsOpen && isUserLoaded) {
        liveBots.push(num);
      } else {
        deadBots.push(num);
      }
    }

    if (liveBots.length === 0) {
      return await reply(
        `╭───❮ ⚡ *HESHAN-MD BOT MONITOR* ⚡ ❯───╮\n` +
        `│\n` +
        `│ ⚠️ *දැනට කිසිදු Live Active Bot කෙනෙක් නොමැත!*\n` +
        `│ 🥀 Disconnected Slots : ${deadBots.length}\n` +
        `│ 📊 Total Tracked Slots: ${allSessionKeys.length}\n` +
        `│\n` +
        `╰───────────────────────────────────────╯\n` +
        `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ⚡`
      );
    }

    // 📋 LIVE BOTS REPORT
    let listText = '';
    liveBots.forEach((num, index) => {
      listText += `│  [${index + 1}] +${num} 🟢 LIVE\n`;
    });

    const report = 
      `╭───❮ ⚡ *DEVELOPER BOT MONITOR* ⚡ ❯───╮\n` +
      `│\n` +
      `├ 🟢 *Real Live Bots :* ${liveBots.length} Active\n` +
      `├ 🔴 *Inactive Slots :* ${deadBots.length} Disconnected\n` +
      `├ 📊 *Total Sessions :* ${allSessionKeys.length}\n` +
      `├ 👑 *Root Developer :* +${DEVELOPER_NUMBER}\n` +
      `│\n` +
      `├──────❮ 🤖 *ACTIVE WORKERS* ❯──────╮\n` +
      `│\n` +
      `${listText}` +
      `│\n` +
      `╰───────────────────────────────────╯\n` +
      `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ⚡`;

    await reply(report);
    sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
  }
};
