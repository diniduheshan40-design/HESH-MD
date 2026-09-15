const axios = require('axios');

module.exports = {
    name: 'fb',
    alias: ['facebook'],
    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        const url = args[0];

        if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
            return await sock.sendMessage(chatJid, { 
                text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර Facebook වීඩියෝ link එකක් ඇතුළත් කරන්න!*\n\n📘 *Example:*\n• .fb https://www.facebook.com/watch?v=xxxx\n• .facebook https://fb.watch/xxxx/${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        const API_BASE = "https://api.chamindu.site";
        const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";

        try {
            await sock.sendMessage(chatJid, { react: { text: '⏳', key: msg.key } });

            const res = await axios.get(`${API_BASE}/api/v1/download/facebook?url=${encodeURIComponent(url.trim())}&api_key=${API_KEY}`, { timeout: 20000 });
            const data = res.data?.data;

            if (!data || (!data.hd && !data.sd)) {
                await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
                return await sock.sendMessage(chatJid, { 
                    text: `❌ *Could not extract Facebook video. Make sure the video is public!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const videoUrl = data.hd || data.sd;
            const qualityTag = data.hd ? "HD" : "SD";

            const caption = `*📘 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📘*\n\n📌 *Title:* ${data.title || 'Facebook Video'}\n📊 *Quality:* ${qualityTag}${DEFAULT_FOOTER}`;

            await sock.sendMessage(chatJid, {
                video: { url: videoUrl },
                caption: caption
            }, { quoted: msg });

            await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('FB DL Error:', err.message);
            await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(chatJid, { 
                text: `❌ *Facebook Download Error:* ${err.message}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};
