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

        // Fast Non-blocking Reaction
        sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

        const cleanUrl = url.trim();
        let videoUrl = null;
        let title = "Instagram Reel";

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        };

        // ⚡ High-Speed Fallback Array (Timeouts reduced for instantaneous switching)
        const fetchMethods = [
            // Method 1: Chamindu Media API
            async () => {
                const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
                const apiUrl = `https://api.chamindu.site/api/v1/media/instagram?url=${encodeURIComponent(cleanUrl)}&api_key=${API_KEY}`;
                const res = await axios.get(apiUrl, { timeout: 8000, headers });
                const resData = res.data?.data || res.data;

                if (Array.isArray(resData) && resData.length > 0) {
                    return resData[0]?.url || resData[0]?.download_url || (typeof resData[0] === 'string' ? resData[0] : null);
                } else if (resData) {
                    if (resData.title) title = resData.title;
                    return resData.fast_download || resData.video || resData.url || resData.download_url;
                }
                return null;
            },
            // Method 2: David Cyril API
            async () => {
                const res = await axios.get(`https://api.davidcyriltech.my.id/instagram?url=${encodeURIComponent(cleanUrl)}`, { timeout: 7000, headers });
                const data = res.data?.result;
                if (Array.isArray(data) && data.length > 0) return data[0]?.url || data[0];
                return data?.url || null;
            },
            // Method 3: Agatz API
            async () => {
                const res = await axios.get(`https://api.agatz.xyz/api/instagram?url=${encodeURIComponent(cleanUrl)}`, { timeout: 7000, headers });
                const data = res.data?.data;
                if (Array.isArray(data) && data.length > 0) return data[0]?.url;
                return null;
            }
        ];

        try {
            for (const method of fetchMethods) {
                try {
                    const resultUrl = await method();
                    if (resultUrl && typeof resultUrl === 'string' && resultUrl.startsWith('http')) {
                        videoUrl = resultUrl;
                        break;
                    }
                } catch (e) {}
            }

            if (!videoUrl) {
                sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *Instagram වීඩියෝව ලබාගත නොහැක. Post එක Public එකක් දැයි පරීක්ෂා කරන්න!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const caption = `*📸 𝗜𝗡𝗦𝗧𝗔𝗚𝗥𝗔𝗠 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📸*\n\n📌 *Title:* ${title}${DEFAULT_FOOTER}`;

            // ⚡ Zero-Copy Stream Dispatch
            await sock.sendMessage(targetChat, {
                video: { url: videoUrl },
                caption: caption,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('Instagram DL Error:', err?.message || err);
            sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ *Instagram Download Error:* ${err?.message || 'Server connection failed'}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};
