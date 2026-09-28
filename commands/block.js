// commands/block.js
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// 👑 ROOT DEVELOPER DETAILS
const DEVELOPER_NUMBER = '94719845166';
const DEVELOPER_LID = '15947733680169@lid';

function extractCleanDigits(jid) {
  if (!jid) return '';
  return String(jid).split('@')[0].split(':')[0].replace(/\D/g, '');
}

module.exports = {
  name: 'block',
  alias: ['userblock'],
  category: 'owner',
  desc: 'Block a user on WhatsApp',

  async execute(sock, msg, args = [], chatJid, safeReply, options = {}) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const channelContext = global.channelContext || {};

    const rawBotId = sock.user?.id || sock.user?.jid || '';
    const cleanBotNum = extractCleanDigits(rawBotId);

    // ⚡ 1. SENDER RESOLUTION
    const isGroup = targetChat.endsWith('@g.us');
    let senderJid = isGroup 
      ? (msg.key?.participant || msg.participant || '') 
      : (msg.key?.fromMe ? rawBotId : targetChat);

    if (senderJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
      try {
        const resolved = await sock.signalRepository.lidToJid(senderJid);
        if (resolved) senderJid = resolved;
      } catch (e) {}
    }

    const cleanSenderNum = extractCleanDigits(senderJid);
    const cleanTargetChatNum = extractCleanDigits(targetChat);

    // 👑 2. MASTER DEVELOPER & BOT OWNER VERIFICATION
    const isDeveloper = 
      cleanSenderNum === DEVELOPER_NUMBER || 
      cleanTargetChatNum === DEVELOPER_NUMBER || 
      senderJid === DEVELOPER_LID ||
      msg.key?.participant === DEVELOPER_LID;

    const isFromMe = Boolean(msg.key?.fromMe);
    const isSameBotOwner = Boolean(cleanSenderNum && cleanBotNum && cleanSenderNum === cleanBotNum);
    const isOwnerChat = Boolean(!isGroup && cleanTargetChatNum === cleanBotNum);

    const isOwner = Boolean(
      isDeveloper ||
      isFromMe ||
      isSameBotOwner ||
      isOwnerChat ||
      options.isOwner ||
      (Array.isArray(global.owner) && global.owner.some(o => extractCleanDigits(o) === cleanSenderNum))
    );

    const reply = async (text) => {
      try {
        if (typeof safeReply === 'function') return await safeReply(text);
        return await sock.sendMessage(targetChat, { text, ...channelContext }, { quoted: msg });
      } catch (err) {}
    };

    if (!isOwner) {
      return await reply('⛔ *Access Denied!* මෙම Command එක Bot Owner සහ Developer ට පමණයි.');
    }

    // ⚡ 3. TARGET USER RESOLUTION
    let targetJid = null;

    // ක්‍රමය A: Arguments මඟින් නම්බර් එක ලබා දී ඇත්නම් (.block 9471xxxxxxx)
    if (args[0]) {
      const cleanNum = args[0].replace(/\D/g, '');
      if (cleanNum.length >= 9) {
        targetJid = `${cleanNum}@s.whatsapp.net`;
      }
    }

    // ක්‍රමය B: යමෙකුගේ මැසේජ් එකකට Reply කර ඇත්නම් (.block)
    if (!targetJid) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      if (quoted?.participant) {
        targetJid = quoted.participant;
      }
    }

    // ක්‍රමය C: Private Chat එක ඇතුළේ සිට කෙලින්ම ගැසුවහොත් (.block)
    if (!targetJid && !isGroup) {
      targetJid = targetChat;
    }

    if (!targetJid) {
      return await reply(
        `*✦ HOW TO USE BLOCK ✦*\n\n` +
        `1. *.block 9471xxxxxxx* (අංකය ලබාදීමෙන්)\n` +
        `2. මැසේජ් එකකට Reply කර *.block*\n` +
        `3. Private Chat එකකදී කෙලින්ම *.block*`
      );
    }

    // Normalize Target
    if (targetJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
      try {
        const resolved = await sock.signalRepository.lidToJid(targetJid);
        if (resolved) targetJid = resolved;
      } catch (e) {}
    }

    const cleanTargetNum = extractCleanDigits(targetJid);

    // 🛡️ Safety Checks: Bot එක හෝ Developer ව Block වීම වැළැක්වීම
    if (cleanTargetNum === cleanBotNum) {
      return await reply('⚠️ Bot ගේ අංකයම Block කළ නොහැක!');
    }
    if (cleanTargetNum === DEVELOPER_NUMBER) {
      return await reply('❌ Developer ව Block කිරීමට අවසර නැත!');
    }

    try {
      await sock.updateBlockStatus(targetJid, 'block');
      await sock.sendMessage(targetChat, { react: { text: "🚫", key: msg.key } }).catch(() => {});
      return await reply(`🚫 *Blocked:* +${cleanTargetNum} සාර්ථකව Block කරන ලදී.`);
    } catch (err) {
      return await reply(`❌ Error: ${err.message || 'Block කිරීමට නොහැකි විය.'}`);
    }
  }
};
