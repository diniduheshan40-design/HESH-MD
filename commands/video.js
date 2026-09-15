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

        const textQuery = args.join(' ').trim();

        if (!textQuery) {
            return await sock.sendMessage(targetChat, { 
                text: '❌ කරුණාකර YouTube link එකක් ඇතුළත් කරන්න.\n\n*උදාහරණ:* `.video https://www.youtube.com/watch?v=...`' 
            }, { quoted: msg });
        }

        // Processing Reaction
        await sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

        try {
            const apiKey = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';
            const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp4?url=${encodeURIComponent(textQuery)}&quality=1080p&api_key=${apiKey}`;

            // API Details ලබා ගැනීම
            const response = await axios.get(apiUrl, { timeout: 60000 });
            const resData = response.data;

            if (!resData || !resData.status || !resData.data) {
                await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: '❌ වීඩියෝව ලබා ගැනීමට නොහැකි විය. Link එක නැවත පරීක්ෂා කරන්න.' 
                }, { quoted: msg });
            }

            const { title, direct_url, download_url, quality } = resData.data;
            const videoDownloadUrl = direct_url || download_url;

            if (!videoDownloadUrl) {
                await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: '❌ Download link එකක් හමු නොවීය.' 
                }, { quoted: msg });
            }

            // Downloading Reaction
            await sock.sendMessage(targetChat, { react: { text: "📥", key: msg.key } }).catch(() => {});

            // 0 KB ගැටලුව විසඳීමට වීඩියෝව Buffer එකක් ලෙස Download කර ගැනීම
            const videoBuffer = await axios.get(videoDownloadUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                },
                timeout: 120000
            });

            const captionText = `🎬 *${title || 'YouTube Media'}*\n` +
                                `⚙️ *Quality:* ${quality || '1080p'}\n` +
                                `📥 *Engine:* HESHAN-MD Downloader\n\n` +
                                `> 🔐 *heshan ofc • all rights reserved*`;

            // Video එක Buffer එකෙන් යැවීම
            await sock.sendMessage(targetChat, {
                video: Buffer.from(videoBuffer.data),
                mimetype: 'video/mp4',
                caption: captionText
            }, { quoted: msg });

            await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

        } catch (error) {
            console.error('Video Execution Error:', error);
            await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ වීඩියෝව එවීමේදී දෝෂයක් සිදු විය: ${error.message || 'Error downloading video buffer'}` 
            }, { quoted: msg });
        }
    }
};
