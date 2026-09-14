const axios = require('axios');

module.exports = {
    name: 'fb',
    async execute(sock, msg, args, chatJid) {
        const url = args[0];
        if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
            return await sock.sendMessage(chatJid, { 
                text: '⚠️ *කරුණාකර Facebook වීඩියෝ link එකක් ඇතුළත් කරන්න!*\n\n> උදා: `.fb https://www.facebook.com/watch?v=xxxx`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatJid, { react: { text: '⏳', key: msg.key } });

            const res = await axios.get(`https://api.guruapi.tech/fbvideo?url=${encodeURIComponent(url)}`, { timeout: 20000 });
            const videoUrl = res.data?.result?.hd || res.data?.result?.sd;

            if (!videoUrl) {
                return await sock.sendMessage(chatJid, { text: '❌ වීඩියෝව සොයාගත නොහැකි විය. Public video link එකක් දැයි බලන්න.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' }, { quoted: msg });
            }

            await sock.sendMessage(chatJid, {
                video: { url: videoUrl },
                caption: `*🎬 Facebook Video Downloaded*\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`
            }, { quoted: msg });

            await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('FB DL Error:', err.message);
            await sock.sendMessage(chatJid, { text: '❌ Facebook වීඩියෝව ලබා ගැනීමට නොහැකි විය.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' }, { quoted: msg });
        }
    }
};

