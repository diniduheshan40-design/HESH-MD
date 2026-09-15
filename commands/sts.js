const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: "autostatus",
  category: "tools",
  desc: "Send status to inbox on specific emoji reaction or reply",

  async execute(sock, msg, args, chatJid, safeReply) {
    try {
      const allowedEmojis = ['😁', '🙂', '🥰', '❤️', '😂'];

      // Message text ලබාගැනීම
      const rawMsg = msg.message?.extendedTextMessage?.text || 
                     msg.message?.conversation || 
                     args.join(' ').trim();

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = contextInfo?.quotedMessage;

      // Status එකක්ද කියා තහවුරු කිරීම
      const remoteJid = contextInfo?.remoteJid || '';
      const isStatus = remoteJid === 'status@broadcast';

      if (!quotedMsg || !isStatus) {
        return await safeReply({
          text: "⚠️ කරුණාකර Status එකකට Reply කර අදාළ Emoji එකක් හෝ `.autostatus` යොදන්න!"
        });
      }

      // Deep unwrap to extract media
      let qm = quotedMsg;
      while (
        qm?.viewOnceMessage?.message ||
        qm?.viewOnceMessageV2?.message ||
        qm?.viewOnceMessageV2Extension?.message ||
        qm?.ephemeralMessage?.message
      ) {
        qm = qm.viewOnceMessage?.message ||
             qm.viewOnceMessageV2?.message ||
             qm.viewOnceMessageV2Extension?.message ||
             qm.ephemeralMessage?.message;
      }

      let mediaType = null;
      let mediaMsg = null;

      if (qm?.imageMessage) {
        mediaType = 'image';
        mediaMsg = qm.imageMessage;
      } else if (qm?.videoMessage) {
        mediaType = 'video';
        mediaMsg = qm.videoMessage;
      }

      if (!mediaMsg || !mediaType) {
        return await safeReply({ text: "❌ Status එකේ Photo හෝ Video එකක් හමු නොවුණි!" });
      }

      try {
        await sock.sendMessage(chatJid, { react: { text: '⏳', key: msg.key } });
      } catch (e) {}

      // Fast streaming buffer
      const stream = await downloadContentFromMessage(mediaMsg, mediaType);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const senderParticipant = contextInfo?.participant || '';
      const senderNumber = senderParticipant ? senderParticipant.split('@')[0] : 'Unknown';
      const caption = mediaMsg.caption ? `\n📝 *Caption:* ${mediaMsg.caption}` : '';

      const sendPayload = {
        caption: `*📥 STATUS DOWNLOADED*\n👤 *From:* +${senderNumber}${caption}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`
      };

      if (mediaType === 'image') {
        sendPayload.image = buffer;
      } else {
        sendPayload.video = buffer;
        sendPayload.mimetype = 'video/mp4';
      }

      // යවන්නාගේ Inbox එකට යැවීම
      await sock.sendMessage(chatJid, sendPayload, { quoted: msg });
      try {
        await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });
      } catch (e) {}

    } catch (err) {
      console.error("AutoStatus Error:", err.message);
      try {
        await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
      } catch (e) {}
      await safeReply({ text: "❌ Status එක ලබා ගැනීමේදී දෝෂයක් ඇති විය!" });
    }
  }
};
