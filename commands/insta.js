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

        sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

        const cleanUrl = url.trim();
        let videoUrl = null;
        let title = "Instagram Reel";

        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        };

        const fetchMethods = [
            // 1. Chamindu API (Quota එක තිබුණොත් මෙතනින් මුලින්ම ගනී)
            async () => {
                const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
                const apiUrl = `https://api.chamindu.site/api/v1/media/instagram?url=${encodeURIComponent(cleanUrl)}&api_key=${API_KEY}`;
                const res = await axios.get(apiUrl, { timeout: 6000, headers });
                
                // Quota exhausted හෝ status false නම් ඊළඟ API එකට මාරු වීම
                if (res.data?.status === false || res.data?.detail?.includes('quota exhausted')) {
                    return null;
                }

                const resData = res.data?.data || res.data;
                if (Array.isArray(resData) && resData.length > 0) {
                    return resData[0]?.url || resData[0]?.download_url || (typeof resData[0] === 'string' ? resData[0] : null);
                } else if (resData) {
                    if (resData.title) title = resData.title;
                    return resData.fast_download || resData.video || resData.url || resData.download_url;
                }
                return null;
            },

            // 2. Fallback 1: BK9 Instagram Engine (No Quota Limit)
            async () => {
                const res = await axios.get(`https://bk9.fun/download/instagram?url=${encodeURIComponent(cleanUrl)}`, { timeout: 7000, headers });
                const result = res.data?.BK9;
                if (Array.isArray(result) && result.length > 0) {
                    return result[0]?.url || result[0]?.downloadUrl;
                }
                return null;
            },

            // 3. Fallback 2: Guru API (High Reliability)
            async () => {
                const res = await axios.get(`https://api.guruapi.tech/insta/v1/igdl?url=${encodeURIComponent(cleanUrl)}`, { timeout: 7000, headers });
                const media = res.data?.media;
                if (Array.isArray(media) && media.length > 0) {
                    return media[0]?.url_download || media[0]?.url;
                }
                return null;
            },

            // 4. Fallback 3: Siputzx Downloader
            async () => {
                const res = await axios.get(`https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(cleanUrl)}`, { timeout: 7000, headers });
                const data = res.data?.data;
                if (Array.isArray(data) && data.length > 0) {
                    return data[0]?.url;
                }
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

            // Video එක Buffer එකක් ලෙස download කර යැවීම (Direct link timeout හෝ WhatsApp 403 block වීම වැළැක්වීමට)
            const videoRes = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                timeout: 25000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            await sock.sendMessage(targetChat, {
                video: Buffer.from(videoRes.data),
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
