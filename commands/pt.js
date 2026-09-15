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

        const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
        const apiUrl = `https://api.chamindu.site/api/v1/media/pinterest/infodl?q=${encodeURIComponent(url.trim())}&api_key=${API_KEY}`;

        try {
            await sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

            const res = await axios.get(apiUrl, { timeout: 25000 });
            const data = res.data?.data;

            if (!data) {
                await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *Pinterest media ලබා ගැනීමට නොහැකි විය. Link එක නිවැරදි දැයි පරීක්ෂා කරන්න!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const title = data.title || 'Pinterest Media';
            const downloads = Array.isArray(data.downloads) ? data.downloads : [];

            // 1. Video එකක්දැයි පරික්ෂා කිරීම
            const videoItem = downloads.find(d => d.type === 'video' || (d.link && d.link.includes('.mp4')));

            // 2. Image එකක්දැයි පරික්ෂා කිරීම (Proxy link එක මුලින්ම තෝරාගනී)
            const imageItem = downloads.find(d => d.type === 'image') || 
                              downloads.find(d => d.type === 'image_direct') || 
                              (data.image ? { link: data.image } : null);

            if (videoItem && videoItem.link) {
                // Video එකක් නම් Video එක එවයි
                const caption = `*📌 𝗣𝗜𝗡𝗧𝗘𝗥𝗘𝗦𝗧 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📌*\n\n📝 *Title:* ${title}${DEFAULT_FOOTER}`;
                await sock.sendMessage(targetChat, {
                    video: { url: videoItem.link },
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: msg });

            } else if (imageItem && imageItem.link) {
                // Image එකක් නම් Image එක එවයි
                const caption = `*📌 𝗣𝗜𝗡𝗧𝗘𝗥𝗘𝗦𝗧 𝗜𝗠𝗔𝗚𝗘 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📌*\n\n📝 *Title:* ${title}${DEFAULT_FOOTER}`;
                await sock.sendMessage(targetChat, {
                    image: { url: imageItem.link },
                    caption: caption
                }, { quoted: msg });

            } else {
                throw new Error("No downloadable video or image found.");
            }

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
