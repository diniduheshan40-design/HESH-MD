// commands/fb.js
const axios = require('axios');

module.exports = {
    name: 'fb',
    alias: ['facebook'],
    category: 'download',
    desc: 'Download Facebook Videos with Auto-Delete Notification',

    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const url = args[0];

        if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
            return await sock.sendMessage(targetChat, { 
                text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර Facebook වීඩියෝ link එකක් ඇතුළත් කරන්න!*\n\n📘 *Example:*\n• .fb https://www.facebook.com/watch?v=xxxx\n• .facebook https://fb.watch/xxxx/${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
        const apiUrl = `https://api.chamindu.site/api/v1/facebook?url=${encodeURIComponent(url.trim())}&api_key=${API_KEY}`;

        let loadMsg = null;

        try {
            await sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

            // 🟢 1. Loading / Downloading Message එක යැවීම
            loadMsg = await sock.sendMessage(targetChat, { 
                text: `*⚡ DOWNLOADING FACEBOOK MEDIA ⚡*\n\n⏳ _කරුණාකර මොහොතක් රැඳී සිටින්න, වීඩියෝව සකසමින් පවතී..._${DEFAULT_FOOTER}` 
            }, { quoted: msg });

            const res = await axios.get(apiUrl, { timeout: 35000 });
            const data = res.data?.data || res.data;

            // වීඩියෝ URL එක තෝරාගැනීම
            const videoUrl = data.fast_download_hd || data.hd || data.fast_download || data.fast_download_sd || data.sd;

            if (!videoUrl) {
                if (loadMsg) await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
                await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *Could not extract Facebook video. Make sure the video is public!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const qualityTag = (data.fast_download_hd || data.hd) ? "HD" : "SD";
            const videoTitle = (data.title && !data.title.includes(':')) ? data.title : "Facebook Video";

            const caption = `*📘 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📘*\n\n📌 *Title:* ${videoTitle}\n📊 *Quality:* ${qualityTag}${DEFAULT_FOOTER}`;

            // 🟢 2. Video එක ArrayBuffer එකක් විදිහට Download කරගැනීම (Play නොවී හිරවීම වළක්වයි)
            const videoRes = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                    'Referer': 'https://www.facebook.com/'
                },
                timeout: 60000
            });

            const videoBuffer = Buffer.from(videoRes.data);

            // 🟢 3. කලින් යවපු Loading Message එක Auto-Delete කිරීම
            if (loadMsg) {
                await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
            }

            // 🟢 4. Playable Video එක යැවීම
            await sock.sendMessage(targetChat, {
                video: videoBuffer,
                caption: caption,
                mimetype: 'video/mp4',
                fileName: 'facebook_video.mp4',
                ptv: false
            }, { quoted: msg });

            await sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('FB DL Error:', err.message);
            // Error එකක් ආවොත් load message එක අයින් කිරීම
            if (loadMsg) await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
            await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ *Facebook Download Error:* ${err.message}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};
