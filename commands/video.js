const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "video",
    desc: "Download YouTube video",
    category: "download",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!q) return reply("❌ කරුණාකර YouTube link එකක් හෝ වීඩියෝවේ නම ලබා දෙන්න.");

        // 1. Loading React එක දමයි
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        let videoUrl = q.trim();

        // 2. Link එකක් නොවේ නම් නමෙන් search කර link එක ලබා ගැනීම
        const isUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(videoUrl);
        if (!isUrl) {
            const searchRes = await axios.get(`https://api.chamindu.site/api/v1/youtube/search?query=${encodeURIComponent(videoUrl)}&api_key=chama_api_ec9848130d1aea209f08fb85e0b4720f`).catch(() => null);
            if (searchRes && searchRes.data && searchRes.data.data && searchRes.data.data[0]) {
                videoUrl = searchRes.data.data[0].url;
            }
        }

        const apiKey = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';
        const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp4?url=${encodeURIComponent(videoUrl)}&quality=1080p&api_key=${apiKey}`;

        // API Call
        const response = await axios.get(apiUrl, { timeout: 60000 });
        const resData = response.data;

        if (!resData || !resData.status || !resData.data) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply("❌ වීඩියෝව ලබා ගැනීමට නොහැකි විය. වෙනත් link එකක් උත්සාහ කරන්න.");
        }

        const { title, direct_url, download_url, quality } = resData.data;
        const dlUrl = direct_url || download_url;

        if (!dlUrl) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply("❌ Download link එකක් හමු නොවීය.");
        }

        const caption = `🎬 *${title || 'YouTube Video'}*\n⚙️ *Quality:* ${quality || '1080p'}\n\n*Downloaded Successfully* ✅`;

        // Success React
        await conn.sendMessage(from, { react: { text: '📥', key: mek.key } });

        // Video එක එවයි
        await conn.sendMessage(from, {
            video: { url: dlUrl },
            mimetype: "video/mp4",
            caption: caption
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (e) {
        console.error("VIDEO CMD ERROR:", e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ Error: ${e.message || e}`);
    }
});
