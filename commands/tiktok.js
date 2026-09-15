const axios = require('axios');

module.exports = {
    name: 'tiktok',
    alias: ['tt'],
    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        const url = args[0];

        if (!url || (!url.includes('tiktok.com') && !url.includes('vt.tiktok.com'))) {
            return await sock.sendMessage(chatJid, { 
                text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර TikTok වීඩියෝ link එකක් ඇතුළත් කරන්න!*\n\n📥 *Example:*\n• .tiktok https://vm.tiktok.com/xxxx/\n• .tt https://vt.tiktok.com/xxxx/${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        const API_BASE = "https://api.chamindu.site";
        const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";

        try {
            await sock.sendMessage(chatJid, { react: { text: '⏳', key: msg.key } });

            const res = await axios.get(`${API_BASE}/api/v1/download/tiktok?url=${encodeURIComponent(url.trim())}&api_key=${API_KEY}`, { timeout: 20000 });
            const data = res.data?.data;

            if (!data || !data.downloads) {
                await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
                return await sock.sendMessage(chatJid, { 
                    text: `❌ *වීඩියෝව ලබා ගැනීමට නොහැකි විය. Link එක පරීක්ෂා කරන්න!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const videoUrl = data.downloads.no_watermark_hd || data.downloads.no_watermark;

            if (!videoUrl) {
                await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
                return await sock.sendMessage(chatJid, { 
                    text: `⚠️ *Watermark නොමැති video link එකක් හමු නොවීය!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const caption = `*🎵 𝗧𝗜𝗞𝗧𝗢𝗞 𝗛𝗗 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 🎵*\n\n📝 *Title:* ${data.title || 'TikTok Video'}\n👤 *Author:* ${data.author || 'Creator'}${DEFAULT_FOOTER}`;

            await sock.sendMessage(chatJid, {
                video: { url: videoUrl },
                caption: caption
            }, { quoted: msg });

            await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('TikTok DL Error:', err.message);
            await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(chatJid, { 
                text: `❌ *TikTok Download Error:* ${err.message}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};
