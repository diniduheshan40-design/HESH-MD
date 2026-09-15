const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'save',
  description: 'Download and save ViewOnce photos, videos, audios, or statuses',
  async execute(sock, msg, args, chatJid, safeReply) {
    // Quoted Message එකක් තියෙනවද බැලීම
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (!quotedMsg) {
      return await safeReply({ 
        text: "❌ කරුණාකර Status එකකට හෝ View Once ෆොටෝ/වීඩියෝ එකකට Reply කර .save ලෙස යොදන්න." 
      });
    }

    let mediaMsg = null;
    let mediaType = null;
    let qm = quotedMsg;

    // View Once (V1, V2, Extension) සහ Document wrappers unwrap කිරීම
    if (qm.viewOnceMessage?.message) qm = qm.viewOnceMessage.message;
    else if (qm.viewOnceMessageV2?.message) qm = qm.viewOnceMessageV2.message;
    else if (qm.viewOnceMessageV2Extension?.message) qm = qm.viewOnceMessageV2Extension.message;
    else if (qm.ephemeralMessage?.message) qm = qm.ephemeralMessage.message;
    else if (qm.documentWithCaptionMessage?.message) qm = qm.documentWithCaptionMessage.message;

    if (qm.imageMessage) { 
      mediaType = 'image'; 
      mediaMsg = qm.imageMessage; 
    } else if (qm.videoMessage) { 
      mediaType = 'video'; 
      mediaMsg = qm.videoMessage; 
    } else if (qm.audioMessage) { 
      mediaType = 'audio'; 
      mediaMsg = qm.audioMessage; 
    }

    if (!mediaMsg || !mediaType) {
      return await safeReply({ 
        text: "❌ මෙහි ෆොටෝ, වීඩියෝ හෝ ඕඩියෝ එකක් හමු නොවුණි." 
      });
    }

    try {
      // Downloading reaction
      await sock.sendMessage(chatJid, { react: { text: '⬇️', key: msg.key } });

      // Media Stream එක Buffer කිරීම
      const stream = await downloadContentFromMessage(mediaMsg, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) { 
        buffer = Buffer.concat([buffer, chunk]); 
      }

      // HESHAN-MD UI Card Caption
      const originalCaption = mediaMsg.caption ? `\n\n*📝 Caption:* ${mediaMsg.caption}` : '';
      const captionText = `*⚡ HESHAN-MD MEDIA SAVER ⚡*
────────────────────────────
*📥 Type:* ${mediaType.toUpperCase()}
*🟢 Status:* Successfully Retrieved${originalCaption}
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      // අදාළ Media වර්ගය අනුව යැවීම
      if (mediaType === 'image') {
        await safeReply({ image: buffer, caption: captionText });
      } else if (mediaType === 'video') {
        await safeReply({ video: buffer, caption: captionText });
      } else if (mediaType === 'audio') {
        await safeReply({ 
          audio: buffer, 
          mimetype: mediaMsg.mimetype || 'audio/mp4', 
          ptt: false 
        });
      }

      // Success reaction
      await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });

    } catch (err) {
      console.error("Save Command Error:", err);
      await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
      await safeReply({ text: "❌ File එක බාගත කිරීමේදී දෝෂයක් ඇති විය!" });
    }
  }
};
