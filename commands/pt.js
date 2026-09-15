// commands/pt.js
const axios = require('axios');

module.exports = {
    name: 'pt',
    alias: ['pinterest', 'pindl', 'pinvideo'],
    category: 'download',
    desc: 'Download Pinterest Videos and Media',

    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const url = args[0];

        if (!url || (!url.includes('pinterest.com') && !url.includes('pin.it'))) {
            return await sock.sendMessage(targetChat, { 
                text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර Pinterest video ලින්ක් එකක් ඇතුළත් කරන්න!*\n\n📌 *Example:*\n• .pt https://pin.it/xxxxxx\n• .pt https://www.pinterest.com/pin/xxxxxx/${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
        
        try {
            await sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

            let videoUrl = null;
            let title = "Pinterest Video";

            // 1. Chamindu API Downloader Endpoint
            try {
                const apiRes = await axios.get(`https://api.chamindu.site/api/v1/pinterest?url=${encodeURIComponent(url.trim())}&api_key=${API_KEY}`, { timeout: 15000 });
                const resData = apiRes.data?.data || apiRes.data;
                videoUrl = resData?.video || resData?.url || resData?.download_url || resData?.fast_download;
                if (resData?.title) title = resData.title;
            } catch (apiErr) {
                try {
                    const fallbackRes = await axios.get(`https://api.chamindu.site/api/v1/download/pinterest?url=${encodeURIComponent(url.trim())}&api_key=${API_KEY}`, { timeout: 15000 });
                    const resData2 = fallbackRes.data?.data || fallbackRes.data;
                    videoUrl = resData2?.video || resData2?.url || resData2?.download_url || resData2?.fast_download;
                    if (resData2?.title) title = resData2.title;
                } catch (e) {}
            }

            // 2. Global Backup Engine
            if (!videoUrl) {
                const backupRes = await axios.get(`https://api.agatz.xyz/api/pinterest?url=${encodeURIComponent(url.trim())}`, { timeout: 15000 });
                videoUrl = backupRes.data?.data?.url || backupRes.data?.data?.video;
            }

            if (!videoUrl) {
                await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *Pinterest video එක ලබා ගැනීමට නොහැකි විය. Link එක නිවැරදි දැයි පරීක්ෂා කරන්න!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const caption = `*📌 𝗣𝗜𝗡𝗧𝗘𝗥𝗘𝗦𝗧 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📌*\n\n📝 *Title:* ${title}${DEFAULT_FOOTER}`;

            // Video යැවීම
            await sock.sendMessage(targetChat, {
                video: { url: videoUrl },
                caption: caption,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            await sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('Pinterest DL Error:', err.message);
            await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ *Pinterest Download Error:* ${err.message}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};

