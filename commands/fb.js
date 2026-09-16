// commands/fb.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'fb',
    alias: ['facebook'],
    category: 'download',
    desc: 'Download Facebook Videos Error-Free',

    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const rawUrl = args[0];

        if (!rawUrl || (!rawUrl.includes('facebook.com') && !rawUrl.includes('fb.watch'))) {
            return await sock.sendMessage(targetChat, { 
                text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර නිවැරදි Facebook වීඩියෝ link එකක් ඇතුළත් කරන්න!*\n\n📘 *උදාහරණ:*\n• .fb https://www.facebook.com/watch?v=xxxx\n• .facebook https://fb.watch/xxxx/${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        const cleanUrl = rawUrl.trim();
        let loadMsg = null;
        let tempFilePath = null;

        try {
            await sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

            loadMsg = await sock.sendMessage(targetChat, { 
                text: `*⚡ DOWNLOADING FACEBOOK MEDIA ⚡*\n\n⏳ _වීඩියෝව සකසමින් පවතී, කරුණාකර රැඳී සිටින්න..._${DEFAULT_FOOTER}` 
            }, { quoted: msg });

            let finalDownloadUrl = null;
            let videoTitle = "Facebook Video";

            // 🟢 Method 1: David Cyril Public Stable API
            try {
                const res = await axios.get(`https://api.davidcyriltech.my.id/facebook?url=${encodeURIComponent(cleanUrl)}`, { timeout: 15000 });
                if (res.data?.success && res.data?.result) {
                    finalDownloadUrl = res.data.result.hd || res.data.result.sd;
                    if (res.data.result.title) videoTitle = res.data.result.title;
                }
            } catch (e) {}

            // 🟢 Method 2: NexOracle FB API
            if (!finalDownloadUrl) {
                try {
                    const res = await axios.get(`https://api.nexoracle.com/downloader/facebook?apikey=free_key@maher_apis&url=${encodeURIComponent(cleanUrl)}`, { timeout: 15000 });
                    if (res.data?.status === 200 && res.data?.result) {
                        finalDownloadUrl = res.data.result.hd || res.data.result.sd;
                        if (res.data.result.title) videoTitle = res.data.result.title;
                    }
                } catch (e) {}
            }

            // 🟢 Method 3: Widipe API
            if (!finalDownloadUrl) {
                try {
                    const res = await axios.get(`https://widipe.com/download/fbdl?url=${encodeURIComponent(cleanUrl)}`, { timeout: 15000 });
                    if (res.data?.status && res.data?.result) {
                        finalDownloadUrl = res.data.result.hd || res.data.result.sd;
                    }
                } catch (e) {}
            }

            if (!finalDownloadUrl) {
                throw new Error('වීඩියෝ Link එක ලබා ගැනීමට නොහැකි විය. වීඩියෝව Private එකක් විය හැක.');
            }

            // Temp directory එක හදාගැනීම
            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            tempFilePath = path.join(tempDir, `fb_${Date.now()}.mp4`);

            // Stream එකක් විදිහට file එක write කිරීම (corrupt වීම සම්පූර්ණයෙන්ම වළකයි)
            const response = await axios({
                method: 'GET',
                url: finalDownloadUrl,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                },
                timeout: 60000
            });

            const writer = fs.createWriteStream(tempFilePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // File size validation (නියම mp4 file එකක් බව තහවුරු කරගැනීම)
            const stats = fs.statSync(tempFilePath);
            if (stats.size < 100000) { // 100KB ට වඩා අඩු නම් corrupt එකක්
                throw new Error('ලබාගත් වීඩියෝව වාදනය කළ නොහැකි ගොනුවකි (Corrupted File).');
            }

            if (loadMsg) {
                await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
            }

            const caption = `*📘 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📘*\n\n📌 *Title:* ${videoTitle}${DEFAULT_FOOTER}`;

            // WhatsApp එකට Send කිරීම
            await sock.sendMessage(targetChat, {
                video: fs.readFileSync(tempFilePath),
                caption: caption,
                mimetype: 'video/mp4',
                fileName: 'video.mp4'
            }, { quoted: msg });

            await sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('FB Final DL Error:', err.message);
            if (loadMsg) await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
            await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ *Facebook Download Error:* ${err.message}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        } finally {
            // Memory safe: File එක send උනාට පසු temp එකෙන් delete කිරීම
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (e) {}
            }
        }
    }
};

