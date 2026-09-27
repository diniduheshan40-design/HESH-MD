// commands/bots.js
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// 👑 MASTER DEVELOPER NUMBER
const DEVELOPER_NUMBER = '94719845166';

module.exports = {
  name: 'bots',
  alias: ['subbots', 'activebots', 'botlist'],
  category: 'developer',
  desc: 'List all running sub-bots and server memory stats (Developer Only)',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (content) => {
      if (typeof safeReply === 'function' && typeof content === 'string') return await safeReply(content);
      const payload = typeof content === 'string' ? { text: content } : content;
      return await sock.sendMessage(targetChat, { ...payload, ...(global.channelContext || {}) }, { quoted: msg });
    };

    // ⚡ 1. ACCURATE SENDER & SENDER RESOLUTION (Inbox, Group, fromMe & LID Safe)
    const isGroup = targetChat.endsWith('@g.us');
    let senderJid = '';

    if (msg.key?.fromMe) {
      senderJid = sock.user?.id || '';
    } else if (isGroup) {
      senderJid = msg.key?.participant || msg.participant || '';
    } else {
      senderJid = targetChat;
    }

    // LID to Real Phone Number Resolution
    if (senderJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
      try {
        const resolved = await sock.signalRepository.lidToJid(senderJid);
        if (resolved) senderJid = resolved;
      } catch (e) {}
    }

    // Device port / suffix (:xx) සම්පූර්ණයෙන්ම ඉවත් කර පිරිසිදු අංකය ලබාගැනීම
    const cleanSenderNum = jidNormalizedUser(senderJid).replace(/\D/g, '');
    const myBotNum = jidNormalizedUser(sock.user?.id || '').replace(/\D/g, '');

    // ⚡ 2. DEVELOPER VERIFICATION
    // ඔයා Developer number එකෙන් message එක එව්වත්, නැතහොත් Developer number එක තියෙන bot ගෙන් fromMe විදිහට ගැහුවත් verify වේ
    const isDeveloper = (cleanSenderNum === DEVELOPER_NUMBER) || 
                        (msg.key?.fromMe && myBotNum === DEVELOPER_NUMBER);

    if (!isDeveloper) {
      return await reply(
        `⛔ *Access Denied!* මෙම Command එක භාවිත කළ හැක්කේ ප්‍රධාන Developer හට පමණි (+${DEVELOPER_NUMBER}).`
      );
    }

    sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      const sessions = global.activeSessions || {};
      const sessionKeys = Object.keys(sessions);

      let activeCount = 0;
      let botListText = '';

      sessionKeys.forEach((num, index) => {
        const s = sessions[num];
        const isLive = Boolean(s && s.user?.id && (s.ws?.readyState === 1 || s.ws?.socket?.readyState === 1));
        if (isLive) activeCount++;

        botListText += `│  ${index + 1}. +${num} ⤿ ${isLive ? '🟢 Online' : '🔴 Standby'}\n`;
      });

      if (sessionKeys.length === 0) {
        botListText = `│  _කිසිදු Sub-bot session එකක් හමු නොවීය._\n`;
      }

      const memoryUsage = process.memoryUsage();
      const usedMem = (memoryUsage.rss / (1024 * 1024)).toFixed(1);

      const panel = 
`╭───❮ 👑 *HESHAN-MD ACTIVE BOTS* ❯───╮
│
├ 🤖 *Total Bots  :* ${sessionKeys.length}
├ 🟢 *Live Active :* ${activeCount}
├ 📊 *Node RAM    :* ${usedMem} MB
│
├────❮ 📱 *CONNECTED SESSIONS* ❯────╮
│
${botListText}│
╰────────────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ⚡`.trim();

      sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});
      return await reply(panel);

    } catch (err) {
      console.error('Bots Command Error:', err?.message || err);
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await reply(`❌ *Error:* ${err.message || 'Failed to fetch bot list'}`);
    }
  }
};
