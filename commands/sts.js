// commands/autostatus.js
const { downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');

function unwrapMessage(msgObj) {
  if (!msgObj) return null;
  return (
    msgObj.ephemeralMessage?.message ||
    msgObj.viewOnceMessage?.message ||
    msgObj.viewOnceMessageV2?.message ||
    msgObj.viewOnceMessageV2Extension?.message ||
    msgObj.documentWithCaptionMessage?.message ||
    msgObj
  );
}

module.exports = {
  name: 'autostatus',
  alias: ['statussave', 'getstatus', 'savedstatus'],
  category: 'tools',
  desc: 'Send status to inbox on specific emoji reaction, keyword or reply',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (content) => {
      if (typeof safeReply === 'function' && typeof content === 'string') return await safeReply(content);
      const payload = typeof content === 'string' ? { text: content } : content;
      return await sock.sendMessage(targetChat, { ...payload, ...(global.channelContext || {}) }, { quoted: msg });
    };

    try {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quotedRaw = contextInfo?.quotedMessage;

      // Status එකක්ද කියා තහවුරු කිරීම (status@broadcast)
      const remoteJid = contextInfo?.remoteJid || '';
      const participantJid = contextInfo?.participant || '';
      const isStatus = remoteJid === 'status@broadcast' || participantJid.includes('@broadcast');

      if (!quotedRaw || !isStatus) {
        return await reply("⚠️ කරුණාකර Status එකකට Reply කර අදාළ Emoji එකක් හෝ `.autostatus` යොදන්න!");
      }

      // Deep unwrap to extract media/text
      const qm = unwrapMessage(quotedRaw);

      let mediaType = null;
      let mediaMsg = null;
      let textStatus = null;

      if (qm?.imageMessage) {
        mediaType = 'image';
        mediaMsg = qm.imageMessage;
      } else if (qm?.videoMessage) {
        mediaType = 'video';
        mediaMsg = qm.videoMessage;
      } else if (qm?.audioMessage) {
        mediaType = 'audio';
        mediaMsg = qm.audioMessage;
      } else if (qm?.conversation || qm?.extendedTextMessage?.text) {
        textStatus = qm.conversation || qm.extendedTextMessage?.text;
      }

      if (!mediaMsg && !textStatus) {
        return await reply("❌ Status එකේ Photo, Video, Audio හෝ Text එකක් හමු නොවීය!");
      }

      sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

      // Sender Number Resolution (LID to Phone Number)
      let senderParticipant = participantJid;
      if (senderParticipant.endsWith('@lid') && sock.signalRepository?.lidToJid) {
        try {
          const resolved = await sock.signalRepository.lidToJid(senderParticipant);
          if (resolved) senderParticipant = resolved;
        } catch (e) {}
      }

      const cleanNum = jidNormalizedUser(senderParticipant).replace(/\D/g, '') || 'Status User';
      const footer = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';

      // 1. Text Status Dispatch
      if (textStatus) {
        sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});
        return await reply(
          `*📥 𝗦𝗧𝗔𝗧𝗨𝗦 𝗤𝗨𝗢𝗧𝗘*\n` +
          `👤 *From:* +${cleanNum}\n\n` +
          `💬 *Status:*\n${textStatus}${footer}`
        );
      }

      // 2. Media Stream Download
      const stream = await downloadContentFromMessage(mediaMsg, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      if (!buffer || buffer.length === 0) {
        throw new Error('Buffer empty');
      }

      const captionText = mediaMsg.caption ? `\n📝 *Caption:* ${mediaMsg.caption}` : '';
      const baseCaption = `*📥 𝗦𝗧𝗔𝗧𝗨𝗦 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗*\n👤 *From:* +${cleanNum}${captionText}${footer}`;

      // 3. Dispatch Media
      if (mediaType === 'image') {
        await sock.sendMessage(targetChat, {
          image: buffer,
          caption: baseCaption,
          ...(global.channelContext || {})
        }, { quoted: msg });
      } else if (mediaType === 'video') {
        await sock.sendMessage(targetChat, {
          video: buffer,
          caption: baseCaption,
          mimetype: 'video/mp4',
          ...(global.channelContext || {})
        }, { quoted: msg });
      } else if (mediaType === 'audio') {
        await sock.sendMessage(targetChat, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: Boolean(mediaMsg.ptt),
          ...(global.channelContext || {})
        }, { quoted: msg });
      }

      sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("AutoStatus Error:", err?.message || err);
      sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
      await reply("❌ Status එක ලබා ගැනීමේදී දෝෂයක් ඇති විය!");
    }
  }
};
