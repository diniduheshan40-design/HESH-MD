const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Free WebP Converter API
async function convertToWebp(imageBuffer) {
  const form = new FormData();
  form.append('new-image-url', '');
  form.append('new-image', imageBuffer, { filename: 'image.jpg' });

  const res = await fetch('https://s6.ezgif.com/jpg-to-webp', {
    method: 'POST',
    body: form
  });
  const html = await res.text();
  const fileMatch = html.match(/name="file"\s+value="([^"]+)"/);
  if (!fileMatch) throw new Error('Conversion API failed');

  const fileId = fileMatch[1];
  const convertForm = new FormData();
  convertForm.append('file', fileId);

  const convertRes = await fetch(`https://ezgif.com/jpg-to-webp/${fileId}?ajax=true`, {
    method: 'POST',
    body: convertForm
  });
  const convertHtml = await convertRes.text();
  const imgUrlMatch = convertHtml.match(/src="(\/\/s6\.ezgif\.com\/tmp\/[^"]+)"/);
  if (!imgUrlMatch) throw new Error('Sticker render failed');

  const finalRes = await fetch('https:' + imgUrlMatch[1]);
  return await finalRes.buffer();
}

module.exports = {
  name: 'sticker',
  alias: ['s', 'toimg', 'tomp3'],
  description: 'Media conversions (Stickers, Images, Audio)',
  async execute(sock, msg, args, chatJid, safeReply) {
    const rawMsg = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || 
                   msg.message?.imageMessage?.caption || 
                   '';
    const usedCmd = rawMsg.slice(1).trim().split(/ +/)[0].toLowerCase();

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const currentMsg = msg.message;

    // 🟢 1. STICKER MAKER (.s / .sticker)
    if (usedCmd === 'sticker' || usedCmd === 's') {
      const targetImg = quoted?.imageMessage || currentMsg?.imageMessage;

      if (!targetImg) {
        return await safeReply('⚠️ කරුණාකර Photo එකකට reply කර `.s` හෝ `.sticker` යොදන්න.');
      }

      try {
        await safeReply('⏳ Processing sticker...');
        
        const stream = await downloadContentFromMessage(targetImg, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        // Convert to valid WebP buffer
        const webpBuffer = await convertToWebp(buffer);

        return await sock.sendMessage(chatJid, {
          sticker: webpBuffer
        }, { quoted: msg });

      } catch (err) {
        console.error('Sticker Error:', err.message);
        // Fallback: direct send
        try {
          return await sock.sendMessage(chatJid, {
            sticker: buffer
          }, { quoted: msg });
        } catch (e) {
          return await safeReply(`❌ Sticker creation failed: ${err.message}`);
        }
      }
    }

    // 🟢 2. STICKER TO IMAGE (.toimg)
    if (usedCmd === 'toimg') {
      const targetSticker = quoted?.stickerMessage;

      if (!targetSticker) {
        return await safeReply('⚠️ කරුණාකර Sticker එකකට reply කර `.toimg` යොදන්න.');
      }

      try {
        await safeReply('⏳ Converting to image...');
        const stream = await downloadContentFromMessage(targetSticker, 'sticker');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        return await sock.sendMessage(chatJid, {
          image: buffer,
          caption: '> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡'
        }, { quoted: msg });
      } catch (err) {
        return await safeReply(`❌ Image extraction failed: ${err.message}`);
      }
    }

    // 🟢 3. VIDEO TO MP3 (.tomp3)
    if (usedCmd === 'tomp3') {
      const targetVideo = quoted?.videoMessage || currentMsg?.videoMessage;

      if (!targetVideo) {
        return await safeReply('⚠️ කරුණාකර Video එකකට reply කර `.tomp3` යොදන්න.');
      }

      try {
        await safeReply('⏳ Extracting audio...');
        const stream = await downloadContentFromMessage(targetVideo, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        return await sock.sendMessage(chatJid, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: false
        }, { quoted: msg });
      } catch (err) {
        return await safeReply(`❌ Audio extraction failed: ${err.message}`);
      }
    }
  }
};
