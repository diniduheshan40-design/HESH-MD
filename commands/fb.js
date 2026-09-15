// commands/fb.js
const axios = require('axios');

module.exports = {
    name: 'fb',
    alias: ['facebook'],
    category: 'download',
    desc: 'Download Facebook Videos',

    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        
        // Chat ID එක හරියටම තහවුරු කරගැනීම
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

        try {
            await sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

            const res = await axios.get(apiUrl, { timeout: 30000 });
            const data = res.data?.data || res.data;

            // වීඩියෝ URL එක තෝරාගැනීම (Proxy Download Links මුලින්ම check කරයි)
            const videoUrl = data.fast_download_hd || data.fast_download || data.hd || data.fast_download_sd || data.sd;

            if (!videoUrl) {
                await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *Could not extract Facebook video. Make sure the video is public!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const qualityTag = (data.fast_download_hd || data.hd) ? "HD" : "SD";
            const videoTitle = data.title && data.title !== "0:06" ? data.title : "Facebook Video";

            const caption = `*📘 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📘*\n\n📌 *Title:* ${videoTitle}\n📊 *Quality:* ${qualityTag}${DEFAULT_FOOTER}`;

            // Video එක යැවීම
            await sock.sendMessage(targetChat, {
                video: { url: videoUrl },
                caption: caption,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            await sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('FB DL Error:', err.message);
            await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ *Facebook Download Error:* ${err.message}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};
