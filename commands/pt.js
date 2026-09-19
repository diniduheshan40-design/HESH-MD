// commands/pt.js
const axios = require('axios');

module.exports = {
    name: 'pt',
    alias: ['pinterest', 'pindl', 'pin'],
    category: 'download',
    desc: 'Download Pinterest Media (Video & Image)',

    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const url = args[0];

        if (!url || (!url.includes('pinterest.com') && !url.includes('pin.it'))) {
            return await sock.sendMessage(targetChat, { 
                text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර Pinterest link එකක් ඇතුළත් කරන්න!*\n\n📌 *Example:*\n• .pt https://pin.it/xxxxxx\n• .pt https://www.pinterest.com/pin/xxxxxx/${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        // Fast Non-blocking reaction
        sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

        const cleanUrl = url.trim();
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        };

        try {
            let mediaType = null;
            let mediaUrl = null;
            let title = 'Pinterest Media';

            // ⚡ Multi-API Fast Extraction Pool
            const extractors = [
                // Source 1: Chamindu API
                async () => {
                    const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
                    const apiUrl = `https://api.chamindu.site/api/v1/media/pinterest/infodl?q=${encodeURIComponent(cleanUrl)}&api_key=${API_KEY}`;
                    const res = await axios.get(apiUrl, { timeout: 8000, headers });
                    const data = res.data?.data;
                    if (!data) return null;

                    if (data.title) title = data.title;
                    const downloads = Array.isArray(data.downloads) ? data.downloads : [];

                    const vid = downloads.find(d => d.type === 'video' || (d.link && d.link.includes('.mp4')));
                    if (vid?.link) return { type: 'video', url: vid.link };

                    const img = downloads.find(d => d.type === 'image' || d.type === 'image_direct') || (data.image ? { link: data.image } : null);
                    if (img?.link) return { type: 'image', url: img.link };
                    return null;
                },
                // Source 2: David Cyril API
                async () => {
                    const res = await axios.get(`https://api.davidcyriltech.my.id/pinterest?url=${encodeURIComponent(cleanUrl)}`, { timeout: 7000, headers });
                    if (res.data?.success && res.data?.result) {
                        return { type: 'image', url: res.data.result };
                    }
                    return null;
                },
                // Source 3: NexOracle API
                async () => {
                    const res = await axios.get(`https://api.nexoracle.com/downloader/pinterest?apikey=free_key@maher_apis&url=${encodeURIComponent(cleanUrl)}`, { timeout: 7000, headers });
                    const result = res.data?.result;
                    if (result?.video) return { type: 'video', url: result.video };
                    if (result?.image || (Array.isArray(result) && result[0])) {
                        return { type: 'image', url: result?.image || result[0] };
                    }
                    return null;
                }
            ];

            for (const extractor of extractors) {
                try {
                    const res = await extractor();
                    if (res?.url) {
                        mediaType = res.type;
                        mediaUrl = res.url;
                        break;
                    }
                } catch (e) {}
            }

            if (!mediaUrl) {
                sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *Pinterest media ලබා ගැනීමට නොහැකි විය. Link එක නිවැරදි දැයි පරීක්ෂා කරන්න!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const caption = `*📌 𝗣𝗜𝗡𝗧𝗘𝗥𝗘𝗦𝗧 ${mediaType.toUpperCase()} 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📌*\n\n📝 *Title:* ${title}${DEFAULT_FOOTER}`;

            // Dispatch Media (Video or Image)
            if (mediaType === 'video') {
                await sock.sendMessage(targetChat, {
                    video: { url: mediaUrl },
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: msg });
            } else {
                await sock.sendMessage(targetChat, {
                    image: { url: mediaUrl },
                    caption: caption
                }, { quoted: msg });
            }

            sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('Pinterest DL Error:', err?.message || err);
            sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ *Pinterest Download Error:* ${err?.message || 'Server error'}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};
