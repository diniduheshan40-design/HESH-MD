const axios = require('axios');

module.exports = {
    name: 'video',
    async execute(sock, msg, args, chatJid) {
        const query = args.join(' ');
        if (!query) {
            return await sock.sendMessage(chatJid, { 
                text: '⚠️ *වීඩියෝවේ නම හෝ YouTube link එක ලබා දෙන්න!*\n\n> උදා: `.video Neth Manema`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatJid, { react: { text: '🎬', key: msg.key } });

            // Fast YouTube MP4 Video API
            const searchRes = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(query)}`, { timeout: 35000 });
            const data = searchRes.data?.result;

            if (!data || !data.download_url) {
                return await sock.sendMessage(chatJid, { 
                    text: '❌ වීඩියෝව සොයා ගැනීමට නොහැකි විය. Link එක හෝ නම පරීක්ෂා කරන්න.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
                }, { quoted: msg });
            }

            // වීඩියෝව කෙලින්ම යැවීම
            await sock.sendMessage(chatJid, {
                video: { url: data.download_url },
                caption: `*🎬 ${data.title || 'YouTube Video'}*\n\n⏱️ *Duration:* ${data.duration || 'N/A'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('Video DL Error:', err.message);
            await sock.sendMessage(chatJid, { 
                text: '❌ වීඩියෝව ඩවුන්ලෝඩ් කිරීමේදී දෝෂයක් ඇති විය.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
            }, { quoted: msg });
        }
    }
};

