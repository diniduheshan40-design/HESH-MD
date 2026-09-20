// commands/tourl.js
const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ⚡ Fast Multi-Host Cloud Uploader (Catbox + Pomf Backup)
async function uploadToCloud(buffer, ext = 'png') {
  const fileName = `hesh_media_${Date.now()}.${ext}`;

  // 1. Primary Host: Catbox.moe (Permanent URL)
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename: fileName });

    const res = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: form.getHeaders(),
      timeout: 25000
    });

    if (res.data && typeof res.data === 'string' && res.data.startsWith('http')) {
      return res.data.trim();
    }
  } catch (e) {
    console.error("Catbox upload error, switching to backup:", e.message);
  }

  // 2. Backup Host: Pomf Mirror (Zero Rate-Limit)
  try {
    const formBackup = new FormData();
    formBackup.append('files[]', buffer, { filename: fileName });

    const backupRes = await axios.post('https://pomf2.lain.la/upload.php', formBackup, {
      headers: formBackup.getHeaders(),
      timeout: 25000
    });

    if (backupRes.data?.files?.[0]?.url) {
      return backupRes.data.files[0].url;
    }
  } catch (e) {
    console.error("Pomf backup upload error:", e.message);
  }

  throw new Error("සියලුම Cloud සේවාදායකයන් කාර්යබහුලයි. නැවත උත්සාහ කරන්න.");
}

module.exports = {
  name: 'tourl',
  alias: ['url', 'img2url', 'upload'],
  category: 'utility',
  desc: 'Generate permanent URL for any Image or Media',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // ⚡ Channel Context Info (✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨ + View Channel button)
    const channelContext = global.channelContext?.contextInfo || {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363421906774107@newsletter',
        newsletterName: '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨',
        serverMessageId: 1
      }
    };

    // Message unwrapper
    const messageContent = msg.message?.ephemeralMessage?.message || 
                           msg.message?.viewOnceMessage?.message || 
                           msg.message?.viewOnceMessageV2?.message || 
                           msg.message?.documentWithCaptionMessage?.message ||
                           msg.message;

    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = quotedContext?.quotedMessage;
    const unwrapQuoted = quotedMsg?.ephemeralMessage?.message || 
                         quotedMsg?.viewOnceMessage?.message || 
                         quotedMsg?.viewOnceMessageV2?.message || 
                         quotedMsg;

    // Direct හෝ Quoted මාධ්‍ය තහවුරු කරගැනීම
    const targetMedia = messageContent?.imageMessage || 
                        unwrapQuoted?.imageMessage || 
                        messageContent?.videoMessage || 
                        unwrapQuoted?.videoMessage ||
                        messageContent?.stickerMessage || 
                        unwrapQuoted?.stickerMessage ||
                        messageContent?.documentMessage || 
                        unwrapQuoted?.documentMessage;

    if (!targetMedia) {
      return await sock.sendMessage(targetChat, {
        text: `╭───❮ ⚡ *HESHAN-MD MEDIA URL* ⚡ ❯───╮
│
│ ⚠️ *කරුණාකර Photo එකකට හෝ Video එකකට Reply කරන්න!*
│ 💡 *භාවිතය:* Photo එක Reply කර \`.tourl\` ටයිප් කරන්න.
│
╰────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    const statusMsg = await sock.sendMessage(targetChat, {
      text: "⚡ *Uploading media to cloud server, please wait...*",
      contextInfo: channelContext
    }, { quoted: msg }).catch(() => null);

    try {
      // Direct Baileys Stream Reader (Crash Guard)
      let mediaType = 'image';
      let extension = 'png';

      if (messageContent?.imageMessage || unwrapQuoted?.imageMessage) {
        mediaType = 'image';
        extension = 'png';
      } else if (messageContent?.videoMessage || unwrapQuoted?.videoMessage) {
        mediaType = 'video';
        extension = 'mp4';
      } else if (messageContent?.stickerMessage || unwrapQuoted?.stickerMessage) {
        mediaType = 'sticker';
        extension = 'webp';
      } else if (messageContent?.documentMessage || unwrapQuoted?.documentMessage) {
        mediaType = 'document';
        extension = (targetMedia.fileName?.split('.').pop()) || 'bin';
      }

      const stream = await downloadContentFromMessage(targetMedia, mediaType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      if (!buffer || buffer.length === 0) {
        throw new Error("Media stream download failed.");
      }

      const fileSizeBytes = (buffer.length / (1024 * 1024)).toFixed(2);
      const directUrl = await uploadToCloud(buffer, extension);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      const responseText = `╭───❮ 🌐 *PERMANENT MEDIA LINK* ❯───╮
│
├ 📁 *Format :* ${extension.toUpperCase()}
├ 📊 *Size   :* ${fileSizeBytes} MB
├ 🔗 *Link   :* ${directUrl}
│
╰────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

      await sock.sendMessage(targetChat, {
        text: responseText,
        contextInfo: channelContext
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("tourl command execution error:", err.message);
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, {
        text: `❌ *Upload Failed:* ${err.message || "Server busy"}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};

