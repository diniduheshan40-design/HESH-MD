// commands/save.js
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// 🎯 ViewOnce save සඳහා වලංගු Emoji ලැයිස්තුව
const TRIGGER_EMOJIS = ['❤️', '🥺', '😚', '🌚', '😼', '😂', '🫡', '🥱', '🙌', '🖤', '👍', '🤣', '🥰', '🫢', '🤭', '🫣'];

module.exports = {
  name: 'save',
  alias: ['vv', 'viewonce', ...TRIGGER_EMOJIS],
  category: 'tools',
  description: 'Download and save ViewOnce photos, videos, or audios using emojis or .vv',

  async execute(sock, msg, args, chatJid, safeReply) {
    try {
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      
      if (!quotedMsg) {
        return await safeReply({ 
          text: "❌ කරුණාකර View Once ෆොටෝ/වීඩියෝ එකකට Reply කර ඉමෝජියක් හෝ .vv ලෙස යොදන්න." 
        });
      }

      // 1. Safe Deep Unwrap (සියලුම wrappers recursive ලෙස ඉවත් කිරීම)
      let qm = quotedMsg;
      while (
        qm?.viewOnceMessage?.message ||
        qm?.viewOnceMessageV2?.message ||
        qm?.viewOnceMessageV2Extension?.message ||
        qm?.ephemeralMessage?.message ||
        qm?.documentWithCaptionMessage?.message
      ) {
        qm = qm.viewOnceMessage?.message ||
             qm.viewOnceMessageV2?.message ||
             qm.viewOnceMessageV2Extension?.message ||
             qm.ephemeralMessage?.message ||
             qm.documentWithCaptionMessage?.message;
      }

      let mediaMsg = null;
      let mediaType = null;

      if (qm?.imageMessage) { 
        mediaType = 'image'; 
        mediaMsg = qm.imageMessage; 
      } else if (qm?.videoMessage) { 
        mediaType = 'video'; 
        mediaMsg = qm.videoMessage; 
      } else if (qm?.audioMessage) { 
        mediaType = 'audio'; 
        mediaMsg = qm.audioMessage; 
      }

      if (!mediaMsg || !mediaType) {
        return await safeReply({ 
          text: "❌ මෙහි View Once ෆොටෝ, වීඩියෝ හෝ ඕඩියෝ එකක් හමු නොවුණි." 
        });
      }

      // 2. React Downloading
      try {
        await sock.sendMessage(chatJid, { react: { text: '⬇️', key: msg.key } });
      } catch (e) {}

      // 3. Fast Stream Buffering
      const stream = await downloadContentFromMessage(mediaMsg, mediaType);
      const chunks = [];
      for await (const chunk of stream) { 
        chunks.push(chunk); 
      }
      const buffer = Buffer.concat(chunks);

      const originalCaption = mediaMsg.caption ? `\n\n*📝 Caption:* ${mediaMsg.caption}` : '';
      const captionText = `*⚡ HESHAN-MD VIEW ONCE SAVER ⚡*
────────────────────────────
*📥 Type:* ${mediaType.toUpperCase()}
*🟢 Status:* Successfully Retrieved${originalCaption}
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      // 4. Safe Payload Dispatch
      if (mediaType === 'image') {
        await safeReply({ image: buffer, caption: captionText });
      } else if (mediaType === 'video') {
        await safeReply({ 
          video: buffer, 
          caption: captionText,
          mimetype: mediaMsg.mimetype || 'video/mp4'
        });
      } else if (mediaType === 'audio') {
        await safeReply({ 
          audio: buffer, 
          mimetype: mediaMsg.mimetype || 'audio/mp4', 
          ptt: Boolean(mediaMsg.ptt)
        });
      }

      try {
        await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });
      } catch (e) {}

    } catch (err) {
      console.error("Save Command Error:", err.message);
      try {
        await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
      } catch (e) {}
      await safeReply({ text: "❌ File එක බාගත කිරීමේදී දෝෂයක් ඇති විය!" });
    }
  }
};
