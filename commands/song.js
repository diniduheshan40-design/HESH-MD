const fetch = require('node-fetch');
let yts;
try {
    yts = require('yt-search');
} catch (e) {
    yts = null;
}

module.exports = {
    name: 'song',
    async execute(sock, msg, args, chatJid) {
        const targetChat = chatJid || msg.key.remoteJid;
        const query = args.join(' ').trim();

        if (!query) {
            return await sock.sendMessage(targetChat, { 
                text: "❗ *කරුණාකර සිංදුවේ නම හෝ YouTube Link එකක් ලබාදෙන්න!*\n\n*උදාහරණ:* `.song Faded`" 
            }, { quoted: msg });
        }

        try {
            // 1. Command එකට 🎶 React කිරීම
            await sock.sendMessage(targetChat, {
                react: { text: "🎶", key: msg.key }
            });

            let videoUrl = '';
            let videoTitle = query;
            let videoThumb = 'https://files.catbox.moe/a58add.jpeg';
            let duration = 'N/A';
            let author = 'HESHAN-MD Music';

            // YouTube Search හෝ Link හඳුනාගැනීම
            if (query.startsWith('http://') || query.startsWith('https://')) {
                videoUrl = query;
            } else {
                if (!yts) {
                    return await sock.sendMessage(targetChat, { text: "❌ Search dependency miss වී ඇත. Direct Link එකක් දෙන්න." }, { quoted: msg });
                }
                const searchResults = await yts(query);
                if (!searchResults?.videos?.length) {
                    return await sock.sendMessage(targetChat, { text: "❌ සිංදුව සොයා ගැනීමට නොහැකි විය!" }, { quoted: msg });
                }
                const video = searchResults.videos[0];
                videoUrl = video.url;
                videoTitle = video.title;
                videoThumb = video.thumbnail;
                duration = video.timestamp || 'N/A';
                author = video.author?.name || author;
            }

            // 2. Chamindu API එකෙන් Direct Link එක ගැනීම
            const apiKey = 'chama_api_b764539713b0514de0dbb60f401cd69e';
            const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=320kbps&api_key=${apiKey}`;

            const res = await fetch(apiUrl);
            const json = await res.json();

            if (!json.status || !json.data || !json.data.download_url) {
                throw new Error('බාගත කිරීමේ සබැඳිය (Download Link) ලබා ගැනීමට නොහැකි විය.');
            }

            const downloadUrl = json.data.download_url || json.data.direct_url;
            const finalTitle = json.data.title || videoTitle;
            const finalThumb = json.data.thumbnail || videoThumb;

            // 3. Track Info Card එක යැවීම
            const songCard = `╭───❮ *HESHAN-MD MUSIC* ❯───╮
│
├◈ 🎵 *Title:* ${finalTitle}
├◈ ⏱️ *Duration:* ${duration}
├◈ 👤 *Artist:* ${author}
│
╰───────────────────────────╯
> 📥 *Uploading Audio...*`;

            try {
                await sock.sendMessage(targetChat, {
                    image: { url: finalThumb },
                    caption: songCard
                }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(targetChat, { text: songCard }, { quoted: msg });
            }

            // 4. Audio එක Buffer නොකර කෙලින්ම URL එකෙන් Stream කර යැවීම (RAM ඉතිරි වේ)
            await sock.sendMessage(targetChat, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${finalTitle}.mp3`
            }, { quoted: msg });

            // 5. සාර්ථක වූ පසු ✅ React කිරීම
            await sock.sendMessage(targetChat, {
                react: { text: "✅", key: msg.key }
            });

        } catch (err) {
            console.error('Song Command Error:', err);
            await sock.sendMessage(targetChat, { 
                text: `❌ *Song Download Error:* ${err.message}` 
            }, { quoted: msg });
        }
    }
};

