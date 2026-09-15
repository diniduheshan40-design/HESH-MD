// commands/video.js
const axios = require('axios');

module.exports = {
    name: 'video',
    category: 'download',
    desc: 'Download YouTube video in MP4 format',

    async execute(sock, msg, args, chatJid) {
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        // Query එක ලබා ගැනීම
        const textQuery = args.join(' ').trim();

        if (!textQuery) {
            return await sock.sendMessage(targetChat, { 
                text: '❌ කරුණාකර YouTube link එකක් ඇතුළත් කරන්න.\n\n*උදාහරණ:* `.video https://www.youtube.com/watch?v=...`' 
            }, { quoted: msg });
        }

        // Loading React එක දැමීම
        await sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

        try {
            const apiKey = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';
            const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp4?url=${encodeURIComponent(textQuery)}&quality=1080p&api_key=${apiKey}`;

            // API request එක ලබා ගැනීම
            const response = await axios.get(apiUrl, { timeout: 60000 });
            const resData = response.data;

            if (!resData || !resData.status || !resData.data) {
                await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: '❌ වීඩියෝව ලබා ගැනීමට නොහැකි විය. කරුණාකර Link එක පරීක්ෂා කරන්න.' 
                }, { quoted: msg });
            }

            const { title, direct_url, download_url, quality } = resData.data;
            const videoDownloadUrl = direct_url || download_url;

            if (!videoDownloadUrl) {
                await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: '❌ Download URL එකක් සොයා ගැනීමට නොහැකි විය.' 
                }, { quoted: msg });
            }

            const captionText = `🎬 *${title || 'YouTube Media'}*\n` +
                                `⚙️ *Quality:* ${quality || '1080p'}\n` +
                                `📥 *Engine:* HESHAN-MD Downloader\n\n` +
                                `> 🔐 *heshan ofc • all rights reserved*`;

            // Download reaction
            await sock.sendMessage(targetChat, { react: { text: "📥", key: msg.key } }).catch(() => {});

            // Video එක එවයි
            await sock.sendMessage(targetChat, {
                video: { url: videoDownloadUrl },
                mimetype: 'video/mp4',
                caption: captionText
            }, { quoted: msg });

            // සාර්ථක වූ පසු Success reaction එක
            await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

        } catch (error) {
            console.error('Video Execution Error:', error);
            await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ දෝෂයක් සිදු විය: ${error.message || 'API Error'}` 
            }, { quoted: msg });
        }
    }
};
