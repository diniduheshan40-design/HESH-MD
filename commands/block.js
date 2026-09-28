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
  alias: ['unblock', 'userblock', 'userunblock'],
  category: 'owner',
  desc: 'Block or unblock a user on WhatsApp',

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

    // 👑 2. DEVELOPER & BOT OWNER VERIFICATION
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
      return await reply('⛔ *Access Denied!* මෙම විධානය Bot Owner සහ Developer ට පමණයි.');
    }

    // ⚡ 3. ACTION RESOLUTION (Block ද Unblock ද යන්න හඳුනාගැනීම)
    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    const commandUsed = rawText.slice(1).trim().split(/\s+/)[0].toLowerCase();
    const isUnblock = commandUsed.includes('unblock');
    const action = isUnblock ? 'unblock' : 'block';

    // ⚡ 4. TARGET USER RESOLUTION
    let rawTarget = null;

    // ක්‍රමය 1: අංකයක් ලබා දී ඇත්නම් (.block 9477xxxxxxx / .unblock 9477xxxxxxx)
    const fullArgs = args.length > 0 ? args.join(' ') : rawText.replace(/^[./!#]?(block|unblock|userblock|userunblock)\s*/i, '');
    const cleanArgsDigits = fullArgs.replace(/\D/g, '');

    if (cleanArgsDigits.length >= 9) {
      rawTarget = `${cleanArgsDigits}@s.whatsapp.net`;
    }

    // ක්‍රමය 2: මැසේජ් එකකට Reply කර ඇත්නම්
    if (!rawTarget) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo;
      if (quoted?.participant) {
        rawTarget = quoted.participant;
      }
    }

    // ක්‍රමය 3: Private Chat එකකදී නම්
    if (!rawTarget && !isGroup && cleanTargetChatNum !== cleanBotNum && cleanTargetChatNum !== DEVELOPER_NUMBER) {
      rawTarget = targetChat;
    }

    if (!rawTarget) {
      return await reply(
        `*✦ HOW TO USE ✦*\n\n` +
        `• *Block:* .block 9471xxxxxxx හෝ reply කර .block\n` +
        `• *Unblock:* .unblock 9471xxxxxxx හෝ reply කර .unblock`
      );
    }

    // Standard JID එකට සකස් කිරීම
    let targetJid = jidNormalizedUser(rawTarget);
    if (targetJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
      try {
        const resolved = await sock.signalRepository.lidToJid(targetJid);
        if (resolved) targetJid = jidNormalizedUser(resolved);
      } catch (e) {}
    }

    const targetDigits = extractCleanDigits(targetJid);
    if (!targetDigits || targetDigits.length < 9) {
      return await reply('❌ වලංගු WhatsApp අංකයක් හඳුනාගත නොහැක.');
    }

    const finalJid = `${targetDigits}@s.whatsapp.net`;

    // 🛡️ Safety Checks
    if (targetDigits === cleanBotNum) {
      return await reply('⚠️ Bot ගේ අංකයම වෙනස් කළ නොහැක!');
    }
    if (targetDigits === DEVELOPER_NUMBER) {
      return await reply('❌ Developer ගේ අංකය වෙනස් කිරීමට අවසර නැත!');
    }

    try {
      await sock.updateBlockStatus(finalJid, action);
      const reactEmoji = isUnblock ? "✅" : "🚫";
      await sock.sendMessage(targetChat, { react: { text: reactEmoji, key: msg.key } }).catch(() => {});

      if (isUnblock) {
        return await reply(`🔓 *Unblocked:* +${targetDigits} සාර්ථකව Unblock කරන ලදී.`);
      } else {
        return await reply(`🚫 *Blocked:* +${targetDigits} සාර්ථකව Block කරන ලදී.`);
      }
    } catch (err) {
      console.error(`${action} Error:`, err);
      return await reply(`❌ ${action.toUpperCase()} failed: ${err.message || 'bad-request'}`);
    }
  }
};
