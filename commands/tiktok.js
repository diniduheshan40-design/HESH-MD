const axios = require('axios');

module.exports = {
    name: 'tiktok',
    async execute(sock, msg, args, chatJid) {
        const url = args[0];
        if (!url || (!url.includes('tiktok.com') && !url.includes('vt.tiktok.com'))) {
            return await sock.sendMessage(chatJid, { 
                text: '⚠️ *කරුණාකර TikTok වීඩියෝ link එකක් ඇතුළත් කරන්න!*\n\n> උදා: `.tiktok https://vt.tiktok.com/xxxx/`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatJid, { react: { text: '⏳', key: msg.key } });

            const res = await axios.post('https://www.tikwm.com/api/', { url }, { timeout: 15000 });
            const data = res.data?.data;

            if (!data || !data.play) {
                return await sock.sendMessage(chatJid, { text: '❌ වීඩියෝව ලබා ගැනීමට නොහැකි විය. Link එක පරීක්ෂා කරන්න.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' }, { quoted: msg });
            }

            await sock.sendMessage(chatJid, {
                video: { url: data.play },
                caption: `*🎬 ${data.title || 'TikTok Video'}*\n\n👤 *Author:* ${data.author?.nickname || 'Unknown'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`
            }, { quoted: msg });

            await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('TikTok DL Error:', err.message);
            await sock.sendMessage(chatJid, { text: '❌ වීඩියෝව ඩවුන්ලෝඩ් කිරීමේදී දෝෂයක් ඇති විය.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' }, { quoted: msg });
        }
    }
};

