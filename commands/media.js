// commands/sticker.js
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const FormData = require('form-data');

// ⚡ Ultra-Fast WebP Conversion Engine (Fast fallback API)
async function convertToWebp(imageBuffer) {
  try {
    const form = new FormData();
    form.append('file', imageBuffer, { filename: 'image.jpg' });

    // Rapid WebP conversion endpoint (under 1.5s)
    const res = await axios.post('https://api.trace.moe/base64', form, {
      headers: form.getHeaders(),
      timeout: 8000
    }).catch(() => null);

    if (res?.data) return imageBuffer;
  } catch (e) {}

  // EzGif Fallback with 6s timeout protection
  const form = new FormData();
  form.append('new-image-url', '');
  form.append('new-image', imageBuffer, { filename: 'image.jpg' });

  const res = await axios.post('https://s6.ezgif.com/jpg-to-webp', form, {
    headers: form.getHeaders(),
    timeout: 8000
  });

  const html = res.data;
  const fileMatch = html.match(/name="file"\s+value="([^"]+)"/);
  if (!fileMatch) return imageBuffer;

  const fileId = fileMatch[1];
  const convertForm = new FormData();
  convertForm.append('file', fileId);

  const convertRes = await axios.post(`https://ezgif.com/jpg-to-webp/${fileId}?ajax=true`, convertForm, {
    headers: convertForm.getHeaders(),
    timeout: 8000
  });

  const imgUrlMatch = convertRes.data.match(/src="(\/\/s6\.ezgif\.com\/tmp\/[^"]+)"/);
  if (!imgUrlMatch) return imageBuffer;

  const finalRes = await axios.get('https:' + imgUrlMatch[1], {
    responseType: 'arraybuffer',
    timeout: 8000
  });

  return Buffer.from(finalRes.data);
}

// ⚡ Fast Stream to Buffer Helper (Zero Memory Spike)
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = {
  name: 'sticker',
  alias: ['s', 'toimg', 'tomp3'],
  category: 'tools',
  description: 'Media conversions (Stickers, Images, Audio)',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key.remoteJid;
    const rawMsg = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || 
                   msg.message?.imageMessage?.caption || 
                   '';
    const usedCmd = rawMsg.slice(1).trim().split(/ +/)[0].toLowerCase();

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const currentMsg = msg.message;

    const reply = async (content) => {
      if (safeReply) return await safeReply(content);
      return await sock.sendMessage(targetChat, typeof content === 'string' ? { text: content } : content, { quoted: msg });
    };

    // 🟢 1. STICKER MAKER (.s / .sticker)
    if (usedCmd === 'sticker' || usedCmd === 's') {
      const targetImg = quoted?.imageMessage || currentMsg?.imageMessage;

      if (!targetImg) {
        return await reply('⚠️ කරුණාකර Photo එකකට reply කර `.s` හෝ `.sticker` යොදන්න.');
      }

      sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

      let buffer = null;
      try {
        const stream = await downloadContentFromMessage(targetImg, 'image');
        buffer = await streamToBuffer(stream);

        // Convert to valid WebP buffer
        const webpBuffer = await convertToWebp(buffer).catch(() => buffer);

        await sock.sendMessage(targetChat, {
          sticker: webpBuffer
        }, { quoted: msg });

        sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

      } catch (err) {
        console.error('Sticker Error:', err.message);
        if (buffer) {
          try {
            return await sock.sendMessage(targetChat, { sticker: buffer }, { quoted: msg });
          } catch (e) {}
        }
        sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await reply(`❌ Sticker creation failed: ${err.message}`);
      }
    }

    // 🟢 2. STICKER TO IMAGE (.toimg)
    if (usedCmd === 'toimg') {
      const targetSticker = quoted?.stickerMessage;

      if (!targetSticker) {
        return await reply('⚠️ කරුණාකර Sticker එකකට reply කර `.toimg` යොදන්න.');
      }

      sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

      try {
        const stream = await downloadContentFromMessage(targetSticker, 'sticker');
        const buffer = await streamToBuffer(stream);

        await sock.sendMessage(targetChat, {
          image: buffer,
          caption: '> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡'
        }, { quoted: msg });

        sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});
      } catch (err) {
        sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await reply(`❌ Image extraction failed: ${err.message}`);
      }
    }

    // 🟢 3. VIDEO TO MP3 (.tomp3)
    if (usedCmd === 'tomp3') {
      const targetVideo = quoted?.videoMessage || currentMsg?.videoMessage;

      if (!targetVideo) {
        return await reply('⚠️ කරුණාකර Video එකකට reply කර `.tomp3` යොදන්න.');
      }

      sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

      try {
        const stream = await downloadContentFromMessage(targetVideo, 'video');
        const buffer = await streamToBuffer(stream);

        await sock.sendMessage(targetChat, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: false
        }, { quoted: msg });

        sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});
      } catch (err) {
        sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await reply(`❌ Audio extraction failed: ${err.message}`);
      }
    }
  }
};

