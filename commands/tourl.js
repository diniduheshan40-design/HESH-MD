// commands/tourl.js
const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function streamToBuffer(stream) {
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

// 🟢 1. Pomf.cat / Uguu Uploader (100% Free & No Block)
async function uploadToUguu(buffer, fileName) {
    const form = new FormData();
    form.append('files[]', buffer, { filename: fileName });
    const res = await axios.post('https://uguu.se/upload.php', form, {
        headers: form.getHeaders(),
        timeout: 25000
    });
    if (res.data?.files?.[0]?.url) {
        return res.data.files[0].url;
    }
    throw new Error('Uguu upload failed');
}

// 🟢 2. TmpFiles Uploader (Fallback)
async function uploadToTmp(buffer, fileName) {
    const form = new FormData();
    form.append('file', buffer, { filename: fileName });
    const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
        headers: form.getHeaders(),
        timeout: 25000
    });
    if (res.data?.data?.url) {
        return res.data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    }
    throw new Error('TmpFiles upload failed');
}

module.exports = {
    name: "tourl",
    alias: ["url", "upload", "imgtourl"],
    category: "utility",
    desc: "Generate direct link for media",

    async execute(sock, msg, args, chatJid, safeReply) {
        const from = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const reply = async (content) => {
            const payload = typeof content === 'string' ? { text: content } : content;
            return await sock.sendMessage(from, payload, { quoted: msg });
        };

        try {
            const m = msg.message?.ephemeralMessage?.message || 
                      msg.message?.viewOnceMessage?.message || 
                      msg.message?.viewOnceMessageV2?.message || 
                      msg.message?.documentWithCaptionMessage?.message || 
                      msg.message;

            const quoted = m?.extendedTextMessage?.contextInfo?.quotedMessage;
            const targetMsg = quoted || m;

            let mediaType = null;
            let mediaObj = null;
            let ext = 'jpg';

            if (targetMsg?.imageMessage) {
                mediaType = 'image';
                mediaObj = targetMsg.imageMessage;
                ext = 'jpg';
            } else if (targetMsg?.videoMessage) {
                mediaType = 'video';
                mediaObj = targetMsg.videoMessage;
                ext = 'mp4';
            } else if (targetMsg?.audioMessage) {
                mediaType = 'audio';
                mediaObj = targetMsg.audioMessage;
                ext = 'mp3';
            } else if (targetMsg?.stickerMessage) {
                mediaType = 'sticker';
                mediaObj = targetMsg.stickerMessage;
                ext = 'webp';
            } else if (targetMsg?.documentMessage) {
                mediaType = 'document';
                mediaObj = targetMsg.documentMessage;
                ext = mediaObj.fileName?.split('.').pop() || 'bin';
            }

            let buffer = null;
            let fileName = `heshan_${Date.now()}.${ext}`;

            if (mediaType && mediaObj) {
                await sock.sendMessage(from, { react: { text: '🔄', key: msg.key } }).catch(() => {});
                const stream = await downloadContentFromMessage(mediaObj, mediaType);
                buffer = await streamToBuffer(stream);
            } else if (args && args.length > 0) {
                buffer = Buffer.from(args.join(" "), 'utf-8');
                fileName = `heshan_${Date.now()}.txt`;
            } else if (quoted?.conversation || quoted?.extendedTextMessage?.text) {
                const txt = quoted.conversation || quoted.extendedTextMessage?.text;
                buffer = Buffer.from(txt, 'utf-8');
                fileName = `heshan_${Date.now()}.txt`;
            } else {
                return await reply("⚠️ ඡායාරූපයකට හෝ වීඩියෝවකට reply කරමින් `.tourl` යවන්න.");
            }

            if (!buffer || buffer.length === 0) {
                return await reply("❌ Media extract කරගැනීමට නොහැකි විය.");
            }

            // Cloud එකට Upload කිරීම (Multi-server fallback)
            let finalUrl = null;

            try {
                finalUrl = await uploadToUguu(buffer, fileName);
            } catch (err1) {
                try {
                    finalUrl = await uploadToTmp(buffer, fileName);
                } catch (err2) {
                    throw new Error("සියලුම Upload සර්වර්ස් කාර්යබහුලයි. මඳ වේලාවකින් උත්සාහ කරන්න.");
                }
            }

            const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

            const outMsg = `┏━━━❮ ⚡ *𝐇𝐄𝐒𝐇𝐀𝐍 - 𝐌𝐃 𝐔𝐑𝐋* ⚡ ❯━━━┓
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
            return await reply(outMsg);

        } catch (e) {
            console.error("Tourl Final Error:", e);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            return await reply(`❌ Error: ${e.message}`);
        }
    }
};

