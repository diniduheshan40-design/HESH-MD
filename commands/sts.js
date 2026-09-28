// commands/status.js
const { downloadMediaMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');

// 🎯 Status ඉල්ලන වචන ලැයිස්තුව
const STATUS_KEYWORDS = [
  'status', 'save', 'oni', 'ඕනි', 'ඕනෙ', 'දෙන්න', 'denna', 'dpn', 
  'dapan', 'ewanna', 'එවන්න', 'ewpn', 'ewapan', 'send', 'evanna'
];

module.exports = {
  name: 'status',
  alias: STATUS_KEYWORDS,
  category: 'tools',
  desc: 'Download WhatsApp Status via reply',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    const reply = async (text) => (typeof safeReply === 'function' ? safeReply(text) : sock.sendMessage(targetChat, { text }, { quoted: msg }));

    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = quotedContext?.quotedMessage;

    if (!quotedMsg) {
      return await reply('📌 කරුණාකර Status එකකට Reply කර `oni` හෝ `save` ලෙස එවන්න.');
    }

    // Media එක හඳුනා ගැනීම
    const isImage = !!quotedMsg.imageMessage;
    const isVideo = !!quotedMsg.videoMessage;
    const isAudio = !!quotedMsg.audioMessage;

    if (!isImage && !isVideo && !isAudio) {
      return await reply('❌ මෙය Download කළ හැකි Status මාධ්‍යයක් නොවේ!');
    }

    try {
      await sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const stanzaId = quotedContext?.stanzaId;
      const participant = quotedContext?.participant || 'status@broadcast';

      const downloadKey = {
        key: {
          id: stanzaId,
          remoteJid: 'status@broadcast',
          participant: participant,
          fromMe: false
        },
        message: quotedMsg
      };

      const buffer = await downloadMediaMessage(downloadKey, 'buffer', {});

      if (!buffer || buffer.length === 0) {
        throw new Error('Download failed');
      }

      const captionText = 
`⚡ *HESHAN-MD STATUS DOWNLOADER* ⚡
━━━━━━━━━━━━━━━━━━━━━
👤 *From:* @${participant.split('@')[0]}
━━━━━━━━━━━━━━━━━━━━━`;

      if (isImage) {
        await sock.sendMessage(targetChat, {
          image: buffer,
          caption: quotedMsg.imageMessage?.caption ? `${captionText}\n\n💬 ${quotedMsg.imageMessage.caption}` : captionText,
          mentions: [participant],
          ...(global.channelContext || {})
        }, { quoted: msg });
      } else if (isVideo) {
        await sock.sendMessage(targetChat, {
          video: buffer,
          caption: quotedMsg.videoMessage?.caption ? `${captionText}\n\n💬 ${quotedMsg.videoMessage.caption}` : captionText,
          mentions: [participant],
          ...(global.channelContext || {})
        }, { quoted: msg });
      } else if (isAudio) {
        await sock.sendMessage(targetChat, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: true,
          ...(global.channelContext || {})
        }, { quoted: msg });
      }

      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Status Download Error:', err?.message || err);
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply('❌ Status එක Download කරගැනීමට නොහැකි විය. Status එක Expire වී තිබිය හැක.');
    }
  }
};
