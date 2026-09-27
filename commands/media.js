// commands/sticker.js
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ⚡ Local Fast FFmpeg WebP Converter
function convertBufferToWebp(inputBuffer, isVideo = false) {
  return new Promise((resolve, reject) => {
    const tempInput = path.join(os.tmpdir(), `temp_in_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`);
    const tempOutput = path.join(os.tmpdir(), `temp_out_${Date.now()}.webp`);

    fs.writeFileSync(tempInput, inputBuffer);

    let ffmpegArgs = [];
    if (isVideo) {
      ffmpegArgs = [
        '-y', '-i', tempInput,
        '-vcodec', 'libwebp',
        '-filter:v', "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
        '-loop', '0',
        '-ss', '00:00:00',
        '-t', '00:00:07',
        '-preset', 'default',
        '-an', '-vsync', '0',
        '-s', '512:512',
        tempOutput
      ];
    } else {
      ffmpegArgs = [
        '-y', '-i', tempInput,
        '-vcodec', 'libwebp',
        '-filter:v', "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0",
        tempOutput
      ];
    }

    const process = spawn(ffmpegPath, ffmpegArgs);

    process.on('close', (code) => {
      try { if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput); } catch (e) {}
      if (code === 0 && fs.existsSync(tempOutput)) {
        const webpData = fs.readFileSync(tempOutput);
        try { if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput); } catch (e) {}
        resolve(webpData);
      } else {
        try { if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput); } catch (e) {}
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    process.on('error', (err) => {
      try { if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput); } catch (e) {}
      try { if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput); } catch (e) {}
      reject(err);
    });
  });
}

// ⚡ Fast Stream to Buffer Helper
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function unwrapMessage(msgObj) {
  if (!msgObj) return null;
  return (
    msgObj.ephemeralMessage?.message ||
    msgObj.viewOnceMessage?.message ||
    msgObj.viewOnceMessageV2?.message ||
    msgObj.viewOnceMessageV2Extension?.message ||
    msgObj.documentWithCaptionMessage?.message ||
    msgObj
  );
}

module.exports = {
  name: 'sticker',
  alias: ['s', 'toimg', 'tomp3'],
  category: 'tools',
  desc: 'Media conversions (Stickers, Images, Audio)',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const rawText = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || 
                    msg.message?.imageMessage?.caption || 
                    '';
    const usedCmd = rawText.trim().replace(/^[./!#]/, '').split(/ +/)[0].toLowerCase() || 'sticker';

    const rawQuoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quoted = unwrapMessage(rawQuoted);
    const currentMsg = unwrapMessage(msg.message);

    const reply = async (content) => {
      if (typeof safeReply === 'function') return await safeReply(content);
      return await sock.sendMessage(targetChat, typeof content === 'string' ? { text: content } : content, { quoted: msg });
    };

    // 🟢 1. STICKER MAKER (.s / .sticker)
    if (usedCmd === 'sticker' || usedCmd === 's') {
      const targetImg = quoted?.imageMessage || currentMsg?.imageMessage;
      const targetVid = quoted?.videoMessage || currentMsg?.videoMessage;

      if (!targetImg && !targetVid) {
        return await reply('⚠️ කරුණාකර Photo එකකට හෝ Short Video එකකට reply කර `.s` යොදන්න.');
      }

      sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

      try {
        let buffer;
        let isVideo = false;

        if (targetVid) {
          if (targetVid.seconds && targetVid.seconds > 10) {
            sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            return await reply('⚠️ Video එක තත්පර 10ට වඩා අඩු විය යුතුය!');
          }
          const stream = await downloadContentFromMessage(targetVid, 'video');
          buffer = await streamToBuffer(stream);
          isVideo = true;
        } else {
          const stream = await downloadContentFromMessage(targetImg, 'image');
          buffer = await streamToBuffer(stream);
        }

        const webpBuffer = await convertBufferToWebp(buffer, isVideo);

        await sock.sendMessage(targetChat, {
          sticker: webpBuffer
        }, { quoted: msg });

        sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

      } catch (err) {
        console.error('Sticker Error:', err?.message || err);
        sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await reply(`❌ Sticker සෑදීම අසාර්ථක විය: ${err.message || 'Error processing media'}`);
      }
      return;
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

        // Convert WebP buffer back to PNG/JPG via FFmpeg
        const tempIn = path.join(os.tmpdir(), `webp_in_${Date.now()}.webp`);
        const tempOut = path.join(os.tmpdir(), `img_out_${Date.now()}.png`);
        fs.writeFileSync(tempIn, buffer);

        await new Promise((res, rej) => {
          const proc = spawn(ffmpegPath, ['-y', '-i', tempIn, tempOut]);
          proc.on('close', (c) => c === 0 ? res() : rej(new Error('Conversion failed')));
          proc.on('error', rej);
        });

        const imageBuffer = fs.readFileSync(tempOut);
        try { fs.unlinkSync(tempIn); fs.unlinkSync(tempOut); } catch (e) {}

        await sock.sendMessage(targetChat, {
          image: imageBuffer,
          caption: '> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡',
          ...(global.channelContext || {})
        }, { quoted: msg });

        sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});
      } catch (err) {
        console.error('ToImg Error:', err?.message || err);
        sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await reply(`❌ Image extraction failed: ${err.message}`);
      }
      return;
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

        const tempIn = path.join(os.tmpdir(), `vid_in_${Date.now()}.mp4`);
        const tempOut = path.join(os.tmpdir(), `aud_out_${Date.now()}.mp3`);
        fs.writeFileSync(tempIn, buffer);

        await new Promise((res, rej) => {
          const proc = spawn(ffmpegPath, ['-y', '-i', tempIn, '-vn', '-acodec', 'libmp3lame', '-b:a', '192k', tempOut]);
          proc.on('close', (c) => c === 0 ? res() : rej(new Error('Audio extraction failed')));
          proc.on('error', rej);
        });

        const audioBuffer = fs.readFileSync(tempOut);
        try { fs.unlinkSync(tempIn); fs.unlinkSync(tempOut); } catch (e) {}

        await sock.sendMessage(targetChat, {
          audio: audioBuffer,
          mimetype: 'audio/mp4',
          ptt: false
        }, { quoted: msg });

        sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});
      } catch (err) {
        console.error('ToMp3 Error:', err?.message || err);
        sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await reply(`❌ Audio extraction failed: ${err.message}`);
      }
    }
  }
};
