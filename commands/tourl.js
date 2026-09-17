// commands/tourl.js
const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: "tourl",
    alias: ["url", "upload", "imgtourl"],
    category: "utility",
    desc: "Generate a permanent URL for any media, sticker, document, or text",

    async execute(sock, msg, args, chatJid, safeReply) {
        const from = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const reply = async (content) => {
            if (typeof safeReply === 'function') return await safeReply(content);
            const payload = typeof content === 'string' ? { text: content } : content;
            return await sock.sendMessage(from, payload, { quoted: msg });
        };

        try {
            await sock.sendMessage(from, { react: { text: '🔄', key: msg.key } }).catch(() => {});

            // 1. Raw Message unwrapping (Ephemeral, ViewOnce ආදී සියල්ල සඳහා)
            const rawMsg = msg.message?.ephemeralMessage?.message || 
                           msg.message?.viewOnceMessage?.message || 
                           msg.message?.viewOnceMessageV2?.message || 
                           msg.message?.documentWithCaptionMessage?.message ||
                           msg.message;

            const contextInfo = rawMsg?.extendedTextMessage?.contextInfo ||
                               rawMsg?.imageMessage?.contextInfo ||
                               rawMsg?.videoMessage?.contextInfo ||
                               rawMsg?.audioMessage?.contextInfo ||
                               rawMsg?.documentMessage?.contextInfo ||
                               rawMsg?.stickerMessage?.contextInfo;

            const quotedMsg = contextInfo?.quotedMessage;

            // Direct Media Check
            const isDirectMedia = rawMsg?.imageMessage || 
                                  rawMsg?.videoMessage || 
                                  rawMsg?.audioMessage || 
                                  rawMsg?.documentMessage || 
                                  rawMsg?.stickerMessage;

            // Quoted Media Check
            const isQuotedMedia = quotedMsg?.imageMessage || 
                                 quotedMsg?.videoMessage || 
                                 quotedMsg?.audioMessage || 
                                 quotedMsg?.documentMessage || 
                                 quotedMsg?.stickerMessage;

            let buffer;
            let fileName = "file.bin";

            // 2. Extract Media or Text Buffer
            if (isDirectMedia) {
                if (rawMsg.imageMessage) fileName = "image.jpg";
                else if (rawMsg.videoMessage) fileName = "video.mp4";
                else if (rawMsg.audioMessage) fileName = "audio.mp3";
                else if (rawMsg.documentMessage) fileName = rawMsg.documentMessage.fileName || "document.file";
                else if (rawMsg.stickerMessage) fileName = "sticker.webp";

                buffer = await downloadMediaMessage(
                    msg,
                    'buffer',
                    {},
                    { logger: undefined }
                );
            } else if (isQuotedMedia) {
                if (quotedMsg.imageMessage) fileName = "image.jpg";
                else if (quotedMsg.videoMessage) fileName = "video.mp4";
                else if (quotedMsg.audioMessage) fileName = "audio.mp3";
                else if (quotedMsg.documentMessage) fileName = quotedMsg.documentMessage.fileName || "document.file";
                else if (quotedMsg.stickerMessage) fileName = "sticker.webp";

                // Baileys media download object payload structure
                const fakeQuoted = {
                    key: {
                        remoteJid: from,
                        id: contextInfo?.stanzaId,
                        participant: contextInfo?.participant
                    },
                    message: quotedMsg
                };

                buffer = await downloadMediaMessage(
                    fakeQuoted,
                    'buffer',
                    {},
                    { logger: undefined }
                );
            } else if (args && args.length > 0) {
                // Command එක පිටුපසින් text එකක් Type කර එව්වොත් (.tourl heshan text)
                buffer = Buffer.from(args.join(" "), 'utf-8');
                fileName = "text.txt";
            } else if (quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text) {
                // Text Message එකකට reply කරලා .tourl ගැහුවොත්
                const textContent = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
                buffer = Buffer.from(textContent, 'utf-8');
                fileName = "text.txt";
            } else {
                return await reply("⚠️ *Usage:*\nReply to an *Image, Video, Audio, Document, Sticker* or *Text* with `.tourl`\n\nOr type: `.tourl <your text>`");
            }

            if (!buffer) {
                return await reply("❌ Failed to process the requested media.");
            }

            // 3. Catbox CDN එකට Upload කිරීම
            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', buffer, { filename: fileName });

            let uploadRes;
            try {
                uploadRes = await axios.post('https://catbox.moe/user/api.php', form, { 
                    headers: form.getHeaders(),
                    timeout: 45000 
                });
            } catch (catboxErr) {
                console.error("Catbox Upload Error:", catboxErr.message);
                return await reply("❌ Uploading to cloud server failed. Please try again.");
            }

            if (uploadRes?.data && typeof uploadRes.data === 'string' && uploadRes.data.startsWith('http')) {
                const uploadedUrl = uploadRes.data.trim();
                let finalUrl = uploadedUrl;

                // 4. devofc.top Shortener API Call
                try {
                    const shortRes = await axios.post('https://url.devofc.top/api/shorten', 
                        { url: uploadedUrl }, 
                        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
                    );

                    if (shortRes.data && shortRes.data.id) {
                        finalUrl = `https://url.devofc.top/${shortRes.data.id}`;
                    }
                } catch (shortErr) {
                    // Fallback to original URL if shortener times out or errors
                }

                // File size calculation
                const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

                const responseMsg = `┏━━━❮ ⚡ *𝐇𝐄𝐒𝐇𝐀𝐍 - 𝐌𝐃 𝐔𝐑𝐋* ⚡ ❯━━━┓
┃
┣━━『 📦 *FILE INFORMATION* 』
┃ ◈ *Name*   : *${fileName}*
┃ ◈ *Size*   : *${fileSizeMB} MB*
┃ ◈ *Status* : *Uploaded 🟢*
┃
┣━━『 🔗 *DIRECT LINK* 』
┃ ${finalUrl}
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`;

                await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
                return await reply(responseMsg);
            } else {
                return await reply("❌ Failed to retrieve uploaded file URL.");
            }

        } catch (err) {
            console.error("Tourl Command Error:", err);
            return await reply(`❌ System Error: ${err.message}`);
        }
    }
};

