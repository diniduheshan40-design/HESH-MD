// commands/tourl.js
const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ⚡ Ultra-Reliable Multi-Host Cloud Uploader
async function uploadToCloud(buffer, ext = 'png', mimeType = 'image/png') {
  const fileName = `hesh_media_${Date.now()}.${ext}`;

  // 1. Primary: Catbox.moe (Permanent URL)
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename: fileName, contentType: mimeType });

    const res = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: {
        ...form.getHeaders(),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    if (res.data && typeof res.data === 'string' && res.data.startsWith('http')) {
      return res.data.trim();
    }
  } catch (e) {
    console.error("Catbox error:", e.response?.data || e.message);
  }

  // 2. Secondary Host: Litterbox (Temporary / Instant fallback)
  try {
    const formLitter = new FormData();
    formLitter.append('reqtype', 'fileupload');
    formLitter.append('time', '72h');
    formLitter.append('fileToUpload', buffer, { filename: fileName, contentType: mimeType });

    const resLitter = await axios.post('https://litterbox.catbox.moe/resources/internals/api.php', formLitter, {
      headers: formLitter.getHeaders(),
      timeout: 30000
    });

    if (resLitter.data && typeof resLitter.data === 'string' && resLitter.data.startsWith('http')) {
      return resLitter.data.trim();
    }
  } catch (e) {
    console.error("Litterbox backup error:", e.response?.data || e.message);
  }

  // 3. Third Host: Quax.at / Pomf Mirror
  try {
    const formPomf = new FormData();
    formPomf.append('files[]', buffer, { filename: fileName, contentType: mimeType });

    const resPomf = await axios.post('https://pomf2.lain.la/upload.php', formPomf, {
      headers: formPomf.getHeaders(),
      timeout: 30000
    });

    if (resPomf.data?.files?.[0]?.url) {
      return resPomf.data.files[0].url;
    }
  } catch (e) {
    console.error("Pomf error:", e.message);
  }

  throw new Error("සියලුම Cloud Hosts කාර්යබහුලයි. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.");
}

module.exports = {
  name: 'tourl',
  alias: ['url', 'img2url', 'upload', 'link'],
  category: 'utility',
  desc: 'Generate permanent or direct URL for any media file',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key?.remoteJid || null);

    if (!targetChat) return;

    const channelContext = global.channelContext?.contextInfo || {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363421906774107@newsletter',
        newsletterName: '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨',
        serverMessageId: 1
      }
    };

    // Deep unwrap for ephemeral / viewOnce v1 & v2
    const unwrap = (m) => {
      if (!m) return null;
      return m.ephemeralMessage?.message || 
             m.viewOnceMessage?.message || 
             m.viewOnceMessageV2?.message || 
             m.viewOnceMessageV2Extension?.message ||
             m.documentWithCaptionMessage?.message || 
             m;
    };

    const directMsg = unwrap(msg.message);
    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = unwrap(quotedContext?.quotedMessage);

    // Identify target message and media category
    let mediaNode = null;
    let mediaType = null;
    let defaultExt = 'bin';

    const checkList = [
      { key: 'imageMessage', type: 'image', ext: 'png' },
      { key: 'videoMessage', type: 'video', ext: 'mp4' },
      { key: 'audioMessage', type: 'audio', ext: 'mp3' },
      { key: 'stickerMessage', type: 'sticker', ext: 'webp' },
      { key: 'documentMessage', type: 'document', ext: 'bin' }
    ];

    // Priority: Quoted first, then direct media
    for (const item of checkList) {
      if (quotedMsg?.[item.key]) {
        mediaNode = quotedMsg[item.key];
        mediaType = item.type;
        defaultExt = item.ext;
        break;
      }
      if (directMsg?.[item.key]) {
        mediaNode = directMsg[item.key];
        mediaType = item.type;
        defaultExt = item.ext;
        break;
      }
    }

    if (!mediaNode || !mediaType) {
      return await sock.sendMessage(targetChat, {
        text: `╭───❮ ⚡ *HESHAN-MD MEDIA URL* ⚡ ❯───╮
│
│ ⚠️ *කරුණාකර Photo / Video / Sticker හෝ Voice Note එකකට Reply කරන්න!*
│ 💡 *භාවිතය:* Media එක Reply කර \`.tourl\` යවන්න.
│
╰────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    // Reaction indicator
    sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    const statusMsg = await sock.sendMessage(targetChat, {
      text: "⚡ *Downloading & uploading media to cloud server...*",
      contextInfo: channelContext
    }, { quoted: msg }).catch(() => null);

    try {
      // Direct stream fetching
      const stream = await downloadContentFromMessage(mediaNode, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      if (!buffer || buffer.length === 0) {
        throw new Error("Media decrypt download failed. Media එක නැවත එවන්න.");
      }

      // Extension handling for documents or custom mime
      let finalExt = defaultExt;
      let mime = mediaNode.mimetype || '';

      if (mediaType === 'document' && mediaNode.fileName) {
        finalExt = mediaNode.fileName.split('.').pop() || defaultExt;
      } else if (mime) {
        if (mime.includes('image/jpeg')) finalExt = 'jpg';
        else if (mime.includes('image/png')) finalExt = 'png';
        else if (mime.includes('video/mp4')) finalExt = 'mp4';
        else if (mime.includes('audio/ogg')) finalExt = 'opus';
        else if (mime.includes('audio/mpeg')) finalExt = 'mp3';
        else if (mime.includes('webp')) finalExt = 'webp';
      }

      const directUrl = await uploadToCloud(buffer, finalExt, mime);
      const fileSizeBytes = (buffer.length / (1024 * 1024)).toFixed(2);

      // Delete status message
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      const responseText = `╭───❮ 🌐 *PERMANENT MEDIA LINK* ❯───╮
│
├ 📁 *Format :* ${finalExt.toUpperCase()}
├ 📊 *Size   :* ${fileSizeBytes} MB
├ 🔗 *Link   :* ${directUrl}
│
╰────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`;

      await sock.sendMessage(targetChat, {
        text: responseText,
        contextInfo: channelContext
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("tourl execution error:", err);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, {
        text: `❌ *Upload Failed:* ${err.message || "Unknown error occurred"}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};

