const axios = require('axios');

module.exports = {
    name: 'song',
    async execute(sock, msg, args, chatJid) {
        const query = args.join(' ');
        if (!query) {
            return await sock.sendMessage(chatJid, { 
                text: '⚠️ *ගීතයේ නම හෝ YouTube link එක ලබා දෙන්න!*\n\n> උදා: `.song Neth Manema`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatJid, { react: { text: '🎵', key: msg.key } });

            const searchRes = await axios.get(`https://api.davidcyriltech.my.id/youtube/mp3?url=${encodeURIComponent(query)}`, { timeout: 25000 });
            const data = searchRes.data?.result;

            if (!data || !data.downloadUrl) {
                return await sock.sendMessage(chatJid, { text: '❌ ගීතය සොයා ගැනීමට නොහැකි විය.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' }, { quoted: msg });
            }

            if (data.image) {
                await sock.sendMessage(chatJid, {
                    image: { url: data.image },
                    caption: `🎶 *Title:* ${data.title}\n⏱️ *Duration:* ${data.duration || 'N/A'}\n\n> ⏳ _Audio එක upload වෙමින් පවතී..._\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`
                }, { quoted: msg });
            }

            await sock.sendMessage(chatJid, {
                audio: { url: data.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${data.title || 'song'}.mp3`
            }, { quoted: msg });

            await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });
        } catch (err) {
            console.error('Song DL Error:', err.message);
            await sock.sendMessage(chatJid, { text: '❌ සින්දුව ඩවුන්ලෝඩ් කිරීමේදී දෝෂයක් ඇති විය.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' }, { quoted: msg });
        }
    }
};

