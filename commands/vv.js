// commands/vv.js
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// 🎯 ViewOnce Trigger වන Emojis ලැයිස්තුව
const TRIGGER_EMOJIS = [
  '🥰', '🌚', '🤌', '🥺', '✨', '🤣', '🤭', '💗', 
  '❤️', '🙂', '👍', '😯', '🥱', '🙌', '😩', '👀', 
  '🫠', '🥵', '🫣', '🫢', 'vv', 'save'
];

module.exports = {
  name: 'vv',
  alias: ['oneview', 'viewonce', 'save', ...TRIGGER_EMOJIS],
  category: 'tools',
  desc: 'Retrieve ViewOnce photos/videos/audio via command or emojis',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    const reply = async (text) => (typeof safeReply === 'function' ? safeReply(text) : sock.sendMessage(targetChat, { text }, { quoted: msg }));

    // Quoted context ලබාගැනීම
    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = quotedContext?.quotedMessage;

    if (!quoted) {
      return await reply('📌 කරුණාකර ViewOnce මාධ්‍යයකට Reply කර `.vv` හෝ කැමති Emoji එකක් යවන්න.');
    }

    // ViewOnce ව්‍යුහය unwrap කිරීම
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
      // Baileys media downloader එකට නිවැරදි key එක සහ stanzaId ලබා දීම
      const stanzaId = quotedContext?.stanzaId;
      const participant = quotedContext?.participant || targetChat;

      const mediaDownloadKey = {
        key: {
          id: stanzaId,
          remoteJid: targetChat,
          participant: participant,
          fromMe: false
        },
        message: viewOnce
      };

      const buffer = await downloadMediaMessage(
        mediaDownloadKey,
        'buffer',
        {}
      );

      if (!buffer || buffer.length === 0) {
        throw new Error('Buffer empty');
      }

      const captionText = 
`🔓 *[ VIEWONCE DECRYPTED ]* 🔓
━━━━━━━━━━━━━━━━━━━━━
> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`;

      if (isImage) {
        await sock.sendMessage(targetChat, {
          image: buffer,
          caption: viewOnce.imageMessage?.caption ? `${captionText}\n\n💬 *Caption:* ${viewOnce.imageMessage.caption}` : captionText
        }, { quoted: msg });
      } else if (isVideo) {
        await sock.sendMessage(targetChat, {
          video: buffer,
          caption: viewOnce.videoMessage?.caption ? `${captionText}\n\n💬 *Caption:* ${viewOnce.videoMessage.caption}` : captionText
        }, { quoted: msg });
      } else if (isAudio) {
        await sock.sendMessage(targetChat, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: true
        }, { quoted: msg });
      }

      // Reaction එකක් එක් කිරීම
      await sock.sendMessage(targetChat, { react: { text: "🔓", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('ViewOnce Download Error:', err?.message || err);
      await reply('❌ ViewOnce මාධ්‍යය ලබාගැනීමට නොහැකි විය. (කල් ඉකුත්වී හෝ Baileys session එකෙන් expire වී තිබිය හැක)');
    }
  }
};
