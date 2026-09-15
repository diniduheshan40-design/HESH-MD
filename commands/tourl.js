const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'tourl',
  category: 'tools',
  desc: 'Convert media to Catbox direct URL',
  async execute(sock, msg, args, chatJid, safeReply) {
    try {
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const targetMsg = quotedMsg || msg.message;

      if (!targetMsg) {
        return await safeReply({
          text: '⚠️ කරුණාකර Photo එකකට හෝ Video එකකට reply කර හෝ caption එකක් ලෙස `.tourl` යොදන්න!'
        });
      }

      // Deep unwrap to extract media
      let qm = targetMsg;
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
      let ext = 'bin';

      if (qm?.imageMessage) {
        mediaType = 'image';
        mediaMsg = qm.imageMessage;
        ext = 'jpg';
      } else if (qm?.videoMessage) {
        mediaType = 'video';
        mediaMsg = qm.videoMessage;
        ext = 'mp4';
      } else if (qm?.audioMessage) {
        mediaType = 'audio';
        mediaMsg = qm.audioMessage;
        ext = 'mp3';
      } else if (qm?.documentMessage) {
        mediaType = 'document';
        mediaMsg = qm.documentMessage;
        const mime = qm.documentMessage.mimetype || '';
        ext = mime.split('/')[1] || 'bin';
      }

      if (!mediaMsg || !mediaType) {
        return await safeReply({
          text: '❌ මෙහි Photo, Video, Audio හෝ Document එකක් හමු නොවුණි!'
        });
      }

      try {
        await sock.sendMessage(chatJid, { react: { text: '⏳', key: msg.key } });
      } catch (e) {}

      // Buffer the media chunks
      const stream = await downloadContentFromMessage(mediaMsg, mediaType);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // Upload to Catbox using native multipart boundary
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      let postData = [];

      postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n`));
      postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="fileToUpload"; filename="file.${ext}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
      postData.push(buffer);
      postData.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const payload = Buffer.concat(postData);

      const response = await axios.post('https://catbox.moe/user/api.php', payload, {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': payload.length
        },
        timeout: 40000
      });

      const url = response.data.trim();

      const replyText = `*⚡ HESHAN-MD URL CONVERTER ⚡*
────────────────────────────
*🔗 Direct URL:* 
${url}

*📦 Type:* ${mediaType.toUpperCase()}
*⚖️ Size:* ${(buffer.length / (1024 * 1024)).toFixed(2)} MB
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      await safeReply({ text: replyText });
      try {
        await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });
      } catch (e) {}

    } catch (err) {
      console.error('tourl error:', err.message);
      try {
        await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
      } catch (e) {}
      await safeReply({ text: '❌ Media එක URL එකකට හැරවීමේදී දෝෂයක් ඇති විය!' });
    }
  }
};
