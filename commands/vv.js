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
      
      // Quoted message එකක් නැත්නම් කිසිම දෙයක් නොකර නවත්වන්න
      if (!quotedMsg) return;

      // 1. Safe Deep Unwrap සහ View Once ද යන්න නිවැරදිව පරීක්ෂා කිරීම
      let qm = quotedMsg;
      let isViewOnce = false;

      if (
        qm?.viewOnceMessage ||
        qm?.viewOnceMessageV2 ||
        qm?.viewOnceMessageV2Extension
      ) {
        isViewOnce = true;
      }

      while (
        qm?.viewOnceMessage?.message ||
        qm?.viewOnceMessageV2?.message ||
        qm?.viewOnceMessageV2Extension?.message ||
        qm?.ephemeralMessage?.message ||
        qm?.documentWithCaptionMessage?.message
      ) {
        if (qm?.viewOnceMessage || qm?.viewOnceMessageV2 || qm?.viewOnceMessageV2Extension) {
          isViewOnce = true;
        }
        qm = qm.viewOnceMessage?.message ||
             qm.viewOnceMessageV2?.message ||
             qm.viewOnceMessageV2Extension?.message ||
             qm.ephemeralMessage?.message ||
             qm.documentWithCaptionMessage?.message;
      }

      // 🛡️ වැදගත්ම කොටස: Quoted කරපු මැසේජ් එක View Once එකක් නෙවෙයි නම් කිසිම මැසේජ් එකක් නොයවා Silent Exit කරන්න!
      if (!isViewOnce) return;

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

      // Media එකක් හොයාගන්න බැරි වුණත් සද්ද නැතුව නවත්වන්න
      if (!mediaMsg || !mediaType) return;

      // 2. React Downloading
      await sock.sendMessage(chatJid, { react: { text: '⬇️', key: msg.key } }).catch(() => {});

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

      await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("Save Command Error:", err.message);
    }
  }
};
