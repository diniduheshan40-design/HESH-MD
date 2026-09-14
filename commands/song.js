const axios = require('axios');

module.exports = {
    name: 'song',
    async execute(sock, msg, args, targetChat) {
        const chatJid = targetChat || msg.key.remoteJid;
        const query = args.join(' ');

        if (!query) {
            return await sock.sendMessage(chatJid, { 
                text: '⚠️ *ගීතයේ නම හෝ YouTube link එක ඇතුළත් කරන්න!*\n\n> උදා: `.song Neth Manema`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatJid, { react: { text: '🎵', key: msg.key } });

            let downloadUrl = null;
            let title = query;
            let thumb = null;

            // ─── API 1: BK9 YouTube Search & Downloader ───
            try {
                const res1 = await axios.get(`https://bk9.fun/download/youtube?q=${encodeURIComponent(query)}`, { timeout: 15000 });
                if (res1.data?.status && res1.data?.BK9?.media) {
                    const audioData = res1.data.BK9.media.audio || res1.data.BK9.media;
                    downloadUrl = audioData.url || audioData.dl_url;
                    title = res1.data.BK9.title || query;
                    thumb = res1.data.BK9.thumbnail;
                }
            } catch (e1) {
                console.log('Song API 1 failed, trying API 2...');
            }

            // ─── API 2: GuruAPI Audio Fallback ───
            if (!downloadUrl) {
                try {
                    const res2 = await axios.get(`https://api.guruapi.tech/ytdl/ytmp3?url=${encodeURIComponent(query)}`, { timeout: 15000 });
                    if (res2.data?.result?.downloadUrl) {
                        downloadUrl = res2.data.result.downloadUrl;
                        title = res2.data.result.title || query;
                        thumb = res2.data.result.thumb;
                    }
                } catch (e2) {
                    console.log('Song API 2 failed, trying API 3...');
                }
            }

            // ─── API 3: Widipe/Siputzx Fast Audio Fallback ───
            if (!downloadUrl) {
                try {
                    const res3 = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(query)}`, { timeout: 15000 });
                    if (res3.data?.status && res3.data?.data?.dl) {
                        downloadUrl = res3.data.data.dl;
                        title = res3.data.data.title || query;
                    }
                } catch (e3) {
                    console.log('Song API 3 failed');
                }
            }

            // කිසිම API එකකින් link එකක් නොලැබුණහොත්
            if (!downloadUrl) {
                await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
                return await sock.sendMessage(chatJid, { 
                    text: '❌ *ගීතය සොයා ගැනීමට හෝ ඩවුන්ලෝඩ් කිරීමට නොහැකි විය.* කරුණාකර වෙනත් නමකින් උත්සාහ කරන්න.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
                }, { quoted: msg });
            }

            // Thumbnail / Loading Card එක යැවීම
            if (thumb) {
                try {
                    await sock.sendMessage(chatJid, {
                        image: { url: thumb },
                        caption: `*🎶 Title:* ${title}\n*📥 Status:* Uploading audio...\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`
                    }, { quoted: msg });
                } catch (imgErr) {}
            }

            // Direct Audio Message එක යැවීම
            await sock.sendMessage(chatJid, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${title.replace(/[^\w\s]/gi, '')}.mp3`
            }, { quoted: msg });

            await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('Song Command Fatal Error:', err.message);
            await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(chatJid, { 
                text: '❌ *ගීතය ඩවුන්ලෝඩ් කිරීමේදී දෝෂයක් ඇති විය.*\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
            }, { quoted: msg });
        }
    }
};
