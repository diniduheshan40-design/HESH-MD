const axios = require('axios');

// Command definition
const videoCommand = {
    pattern: 'video',
    desc: 'Download YouTube video in MP4 format',
    category: 'download',
    use: '<YouTube URL>',
    async execute(conn, mek, m, { args, q, reply }) {
        try {
            // Check if user provided a URL
            if (!q) {
                return reply('❌ කරුණාකර YouTube වීඩියෝ link එකක් ඇතුළත් කරන්න.\n*උදාහරණ:* `.video https://www.youtube.com/watch?v=...`');
            }

            // Basic YouTube link validation
            const isYt = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(q.trim());
            if (!isYt) {
                return reply('❌ කරුණාකර නිවැරදි YouTube URL එකක් ඇතුළත් කරන්න.');
            }

            reply('⏳ වීඩියෝව සකසමින් පවතී, කරුණාකර මොහොතක් රැඳී සිටින්න...');

            const apiKey = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';
            const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp4?url=${encodeURIComponent(q.trim())}&quality=1080p&api_key=${apiKey}`;

            // Fetch data from API
            const response = await axios.get(apiUrl);
            const resData = response.data;

            if (!resData || !resData.status || !resData.data) {
                return reply('❌ වීඩියෝව ලබා ගැනීමට නොහැකි විය. Link එක පරීක්ෂා කර නැවත උත්සාහ කරන්න.');
            }

            const { title, direct_url, download_url, quality, thumbnail } = resData.data;
            const videoUrl = direct_url || download_url;

            if (!videoUrl) {
                return reply('❌ Download link එකක් සොයා ගැනීමට නොහැකි විය.');
            }

            const captionText = `🎬 *${title || 'YouTube Media'}*\n` +
                                `⚙️ *Quality:* ${quality || '1080p'}\n` +
                                `📥 *Downloaded via Bot*`;

            // Send video file
            await conn.sendMessage(
                mek.chat,
                {
                    video: { url: videoUrl },
                    mimetype: 'video/mp4',
                    caption: captionText
                },
                { quoted: mek }
            );

        } catch (error) {
            console.error('Video command error:', error);
            reply('❌ දෝෂයක් සිදු විය! API එකෙහි ගැටලුවක් හෝ සේවාදායකය කාර්යබහුල විය හැක.');
        }
    }
};

module.exports = videoCommand;
