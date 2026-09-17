// commands/tourl.js
const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// Stream එකක් Buffer එකක් බවට හැරවීම
async function streamToBuffer(stream) {
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

module.exports = {
    name: "tourl",
    alias: ["url", "upload", "imgtourl"],
    category: "utility",
    desc: "Generate a permanent URL for any media or text",

    async execute(sock, msg, args, chatJid, safeReply) {
        const from = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const reply = async (content) => {
            const payload = typeof content === 'string' ? { text: content } : content;
            return await sock.sendMessage(from, payload, { quoted: msg });
        };

        try {
            // Unpack Message
            const m = msg.message?.ephemeralMessage?.message || 
                      msg.message?.viewOnceMessage?.message || 
                      msg.message?.viewOnceMessageV2?.message || 
                      msg.message?.documentWithCaptionMessage?.message || 
                      msg.message;

            const quoted = m?.extendedTextMessage?.contextInfo?.quotedMessage;
            const targetMsg = quoted || m;

            // Media වර්ගය හඳුනා ගැනීම
            let mediaType = null;
            let mediaObj = null;
            let ext = 'bin';

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
            let fileName = `file_${Date.now()}.${ext}`;

            // 1. Media බාගත කිරීම (Direct Baileys Stream - කිසිදා crash නොවේ)
            if (mediaType && mediaObj) {
                await sock.sendMessage(from, { react: { text: '🔄', key: msg.key } }).catch(() => {});
                const stream = await downloadContentFromMessage(mediaObj, mediaType);
                buffer = await streamToBuffer(stream);
            } 
            // 2. Text input එකක් නම්
            else if (args && args.length > 0) {
                buffer = Buffer.from(args.join(" "), 'utf-8');
                fileName = `text_${Date.now()}.txt`;
            } else if (quoted?.conversation || quoted?.extendedTextMessage?.text) {
                const txt = quoted.conversation || quoted.extendedTextMessage?.text;
                buffer = Buffer.from(txt, 'utf-8');
                fileName = `text_${Date.now()}.txt`;
            } else {
                return await reply("⚠️ *Usage:*\nඡායාරූපයකට, වීඩියෝවකට, Voice එකකට හෝ Sticker එකකට reply කරමින් `.tourl` යවන්න.\n\nනැතහොත්: `.tourl <ඔබේ text එක>` ලෙස යොදන්න.");
            }

            if (!buffer || buffer.length === 0) {
                return await reply("❌ Media එක extract කර ගැනීමට නොහැකි විය.");
            }

            // Catbox වෙත Upload කිරීම
            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', buffer, { filename: fileName });

            const uploadRes = await axios.post('https://catbox.moe/user/api.php', form, {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': 'Mozilla/5.0'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 60000
            });

            if (!uploadRes.data || !uploadRes.data.startsWith('http')) {
                return await reply("❌ Cloud Server එකට upload කිරීම අසාර්ථක විය.");
            }

            const rawUrl = uploadRes.data.trim();
            let finalUrl = rawUrl;

            // Shortener එක වැඩ නොකළත් URL එක drop නොවන Safe Try-Catch
            try {
                const short = await axios.post('https://url.devofc.top/api/shorten', 
                    { url: rawUrl }, 
                    { headers: { 'Content-Type': 'application/json' }, timeout: 5000 }
                );
                if (short.data?.id) {
                    finalUrl = `https://url.devofc.top/${short.data.id}`;
                }
            } catch (err) {}

            const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

            const resText = `┏━━━❮ ⚡ *𝐇𝐄𝐒𝐇𝐀𝐍 - 𝐌𝐃 𝐔𝐑𝐋* ⚡ ❯━━━┓
┃
┣━━『 📦 *FILE DETAILS* 』
┃ ◈ *Name*   : *${fileName}*
┃ ◈ *Size*   : *${fileSizeMB} MB*
┃ ◈ *Status* : *Active 🟢*
┃
┣━━『 🔗 *DIRECT LINK* 』
┃ ${finalUrl}
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`;

            await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {});
            return await reply(resText);

        } catch (e) {
            console.error("Tourl Full Error:", e);
            await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {});
            return await reply(`❌ Error: ${e.message}`);
        }
    }
};

