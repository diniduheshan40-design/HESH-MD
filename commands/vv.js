// commands/save.js
const { downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');

// 🎯 ViewOnce save සඳහා වලංගු Emoji ලැයිස්තුව
const TRIGGER_EMOJIS = ['❤️', '🥺', '😚', '🌚', '😼', '😂', '🫡', '🥱', '🙌', '🖤', '👍', '🤣', '🥰', '🫢', '🤭', '🫣', 'vv'];

function deepUnwrapViewOnce(quotedMsg) {
  if (!quotedMsg) return { mediaMsg: null, mediaType: null, isViewOnce: false };

  let isViewOnce = Boolean(
    quotedMsg?.viewOnceMessage ||
    quotedMsg?.viewOnceMessageV2 ||
    quotedMsg?.viewOnceMessageV2Extension
  );

  let qm = quotedMsg;

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

  let mediaMsg = null;
  let mediaType = null;

  if (qm?.imageMessage) {
    mediaType = 'image';
    mediaMsg = qm.imageMessage;
    if (qm.imageMessage.viewOnce) isViewOnce = true;
  } else if (qm?.videoMessage) {
    mediaType = 'video';
    mediaMsg = qm.videoMessage;
    if (qm.videoMessage.viewOnce) isViewOnce = true;
  } else if (qm?.audioMessage) {
    mediaType = 'audio';
    mediaMsg = qm.audioMessage;
    if (qm.audioMessage.viewOnce) isViewOnce = true;
  }

  return { mediaMsg, mediaType, isViewOnce };
}

module.exports = {
  name: 'save',
  alias: ['vv', 'viewonce', ...TRIGGER_EMOJIS],
  category: 'tools',
  desc: 'Download and save ViewOnce photos, videos, or audios using emojis or .vv',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    try {
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quotedMsg) return;

      const { mediaMsg, mediaType, isViewOnce } = deepUnwrapViewOnce(quotedMsg);

      // ViewOnce එකක් නොවේ නම් අනවශ්‍ය messages නොයවා නවත්වයි
      if (!isViewOnce || !mediaMsg || !mediaType) return;

      sock.sendMessage(targetChat, { react: { text: '⬇️', key: msg.key } }).catch(() => {});

      // 1. Fast Stream Buffering
      const stream = await downloadContentFromMessage(mediaMsg, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      if (!buffer || buffer.length === 0) return;

      const originalCaption = mediaMsg.caption ? `\n\n*📝 Caption:* ${mediaMsg.caption}` : '';
      const captionText = 
`*⚡ HESHAN-MD VIEW ONCE SAVER ⚡*
────────────────────────────
*📥 Type   :* ${mediaType.toUpperCase()}
*🟢 Status :* Successfully Retrieved${originalCaption}
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      // 2. Dispatch Media
      let sendPayload = {};

      if (mediaType === 'image') {
        sendPayload = {
          image: buffer,
          caption: captionText,
          ...(global.channelContext || {})
        };
      } else if (mediaType === 'video') {
        sendPayload = {
          video: buffer,
          caption: captionText,
          mimetype: mediaMsg.mimetype || 'video/mp4',
          ...(global.channelContext || {})
        };
      } else if (mediaType === 'audio') {
        sendPayload = {
          audio: buffer,
          mimetype: mediaMsg.mimetype || (mediaMsg.ptt ? 'audio/ogg; codecs=opus' : 'audio/mp4'),
          ptt: Boolean(mediaMsg.ptt),
          ...(global.channelContext || {})
        };
      }

      await sock.sendMessage(targetChat, sendPayload, { quoted: msg });
      sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Save Command Error:', err?.message || err);
      sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
    }
  }
};
