const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'vv',
  alias: ['oneview', 'viewonce', 'save'],
  category: 'tools',
  desc: 'Retrieve ViewOnce photos/videos/audio',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    const reply = async (text) => (typeof safeReply === 'function' ? safeReply(text) : sock.sendMessage(targetChat, { text }, { quoted: msg }));

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) {
      return await reply('📌 කරුණාකර ViewOnce මාධ්‍යයකට Reply කර `.vv` ලබා දෙන්න.');
    }

    const viewOnce = quoted.viewOnceMessageV2?.message || 
                     quoted.viewOnceMessage?.message || 
                     quoted.viewOnceMessageV2Extension?.message || 
                     quoted;

    const isImage = !!viewOnce.imageMessage;
    const isVideo = !!viewOnce.videoMessage;
    const isAudio = !!viewOnce.audioMessage;

    if (!isImage && !isVideo && !isAudio) {
      return await reply('❌ මෙය ViewOnce පණිවිඩයක් නොවේ!');
    }

    try {
      const stanzaId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const buffer = await downloadMediaMessage(
        { key: { id: stanzaId, remoteJid: targetChat }, message: viewOnce },
        'buffer',
        {}
      );

      if (isImage) {
        await sock.sendMessage(targetChat, {
          image: buffer,
          caption: viewOnce.imageMessage?.caption || '🔓 ViewOnce Decrypted'
        }, { quoted: msg });
      } else if (isVideo) {
        await sock.sendMessage(targetChat, {
          video: buffer,
          caption: viewOnce.videoMessage?.caption || '🔓 ViewOnce Decrypted'
        }, { quoted: msg });
      } else if (isAudio) {
        await sock.sendMessage(targetChat, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: true
        }, { quoted: msg });
      }
    } catch (err) {
      await reply('❌ ViewOnce මාධ්‍යය ලබාගැනීමට නොහැකි විය.');
    }
  }
};
