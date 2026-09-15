// commands/insta.js
const axios = require('axios');

module.exports = {
    name: 'insta',
    alias: ['ig', 'reels', 'igdl'],
    category: 'download',
    desc: 'Download Instagram Reels and Videos',

    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const url = args[0];

        if (!url || (!url.includes('instagram.com') && !url.includes('instagr.am'))) {
            return await sock.sendMessage(targetChat, { 
                text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර Instagram Reel හෝ Video ලින්ක් එකක් ඇතුළත් කරන්න!*\n\n📸 *Example:*\n• .insta https://www.instagram.com/reel/xxxxxx/\n• .ig https://www.instagram.com/p/xxxxxx/${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
        const apiUrl = `https://api.chamindu.site/api/v1/media/instagram?url=${encodeURIComponent(url.trim())}&api_key=${API_KEY}`;

        try {
            await sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

            let videoUrl = null;
            let title = "Instagram Reel";

            // 1. Chamindu API හරහා උත්සාහ කිරීම
            try {
                const res = await axios.get(apiUrl, { timeout: 25000 });
                const resData = res.data?.data || res.data;

                if (Array.isArray(resData) && resData.length > 0) {
                    videoUrl = resData[0]?.url || resData[0]?.download_url || resData[0];
                } else if (resData) {
                    videoUrl = resData.fast_download || resData.video || resData.url || resData.download_url;
                    if (resData.title) title = resData.title;
                }
            } catch (primaryErr) {
                // Primary API එක fail වුවහොත් හෝ error message එකක් දුන්නොත් fallback එකට මාරු වේ
            }

            // 2. Backup Fallback API (Chamindu API එකෙන් resolve නොවුවහොත්)
            if (!videoUrl) {
                try {
                    const backupRes = await axios.get(`https://api.agatz.xyz/api/instagram?url=${encodeURIComponent(url.trim())}`, { timeout: 20000 });
                    const backupData = backupRes.data?.data;
                    if (Array.isArray(backupData) && backupData.length > 0) {
                        videoUrl = backupData[0]?.url;
                    }
                } catch (e) {}
            }

            if (!videoUrl) {
                await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *Could not resolve Instagram video. Please make sure the account/post is PUBLIC and the link is valid!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const caption = `*📸 𝗜𝗡𝗦𝗧𝗔𝗚𝗥𝗔𝗠 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📸*\n\n📌 *Title:* ${title}${DEFAULT_FOOTER}`;

            // Video එක යැවීම
            await sock.sendMessage(targetChat, {
                video: { url: videoUrl },
                caption: caption,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            await sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('Instagram DL Error:', err.message);
            await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ *Instagram Download Error:* ${err.message}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};
