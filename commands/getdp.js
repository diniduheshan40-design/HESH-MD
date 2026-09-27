// commands/getdp.js
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'getdp',
  alias: ['pp', 'userdp', 'dp'],
  category: 'tools',
  desc: 'Get high quality profile picture of a user or yourself',

  async execute(sock, msg, args, chatJid, safeReply) {
    const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
    };

    try {
      const isGroup = targetChat.endsWith('@g.us');
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      let targetJid = null;

      // 1. Reply කර ඇති විට
      if (contextInfo?.participant) {
        targetJid = contextInfo.participant;
      }
      // 2. Mention කර ඇති විට
      else if (contextInfo?.mentionedJid?.length) {
        targetJid = contextInfo.mentionedJid[0];
      }
      // 3. Number එකක් ලබාදී ඇති විට (උදා: .getdp 94719845166)
      else if (args && args.length > 0) {
        const cleanNumber = args.join('').replace(/\D/g, '');
        if (cleanNumber.length >= 8) {
          targetJid = `${cleanNumber}@s.whatsapp.net`;
        }
      }

      // 4. කිසිවක් ලබාදී නැතිනම් (නිකම්ම .getdp ගැසූ විට තමන්ගේම DP එක ගැනීම)
      if (!targetJid) {
        targetJid = isGroup
          ? (msg.key?.participant || msg.participant || '')
          : (msg.key?.fromMe ? (sock.user?.id || '') : targetChat);
      }

      // ⚡ LID to Real Phone JID Resolution
      if (targetJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
        try {
          const resolved = await sock.signalRepository.lidToJid(targetJid);
          if (resolved) targetJid = resolved;
        } catch (e) {}
      }

      targetJid = jidNormalizedUser(targetJid);

      if (!targetJid) {
        return await reply('⚠️ පරිශීලකයා හඳුනා ගැනීමට නොහැකි විය!');
      }

      sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

      // High Quality Profile Picture fetch
      let dpUrl;
      try {
        dpUrl = await sock.profilePictureUrl(targetJid, 'image');
      } catch (e) {
        sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await reply(`❌ *මෙම පරිශීලකයාගේ Profile Picture එක ලබාගත නොහැක.* (පින්තූරයක් දමා නැත හෝ Privacy සීමා කර ඇත)${DEFAULT_FOOTER}`);
      }

      const cleanNum = targetJid.split('@')[0].split(':')[0];

      await sock.sendMessage(targetChat, { react: { text: '⬆️', key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, {
        image: { url: dpUrl },
        caption: `*👤 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗣𝗥𝗢𝗙𝗜𝗟𝗘 𝗣𝗜𝗖𝗧𝗨𝗥𝗘 👤*\n\n📌 *User:* @${cleanNum}${DEFAULT_FOOTER}`,
        mentions: [targetJid],
        ...(global.channelContext || {})
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('GetDP Error:', err?.message || err);
      sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
      await reply(`❌ *දෝෂයක් ඇති විය:* ${err.message || 'Error fetching picture'}${DEFAULT_FOOTER}`);
    }
  }
};
