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
                text: "❗ *කරුණාකර සිංදුවේ නම හෝ YouTube Link එක ලබාදෙන්න!*\n\n*උදාහරණ:* `.song Faded` හෝ `.song https://youtu.be/...`" 
            }, { quoted: msg });
        }

        try {
            // 1. Command එක ආපු ගමන් 🎶 React කරනවා
            await sock.sendMessage(targetChat, {
                react: { text: "🎶", key: msg.key }
            });

            let videoUrl = '';
            let videoTitle = query;
            let videoThumb = 'https://files.catbox.moe/a58add.jpeg';
            let duration = 'N/A';
            let views = 'N/A';
            let author = 'HESHAN-MD Music';

            // Query එක Link එකක්ද Name එකක්ද පරික්ෂා කිරීම
            if (query.startsWith('http://') || query.startsWith('https://')) {
                videoUrl = query;
            } else {
                if (yts) {
                    const searchResults = await yts(query);
                    if (!searchResults?.videos?.length) {
                        return await sock.sendMessage(targetChat, { text: "❌ සිංදුව සොයා ගැනීමට නොහැකි විය!" }, { quoted: msg });
                    }
                    const video = searchResults.videos[0];
                    videoUrl = video.url;
                    videoTitle = video.title;
                    videoThumb = video.thumbnail;
                    duration = video.timestamp || 'N/A';
                    views = video.views ? video.views.toLocaleString() : 'N/A';
                    author = video.author?.name || author;
                } else {
                    return await sock.sendMessage(targetChat, { text: "❌ Direct YouTube link එකක් ලබාදෙන්න." }, { quoted: msg });
                }
            }

            // 2. Chamindu API එකෙන් MP3 Data ලබාගැනීම
            const apiKey = 'chama_api_b764539713b0514de0dbb60f401cd69e';
            const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=320kbps&api_key=${apiKey}`;

            const res = await fetch(apiUrl);
            const json = await res.json();

            if (!json.status || !json.data || !json.data.download_url) {
                throw new Error('Audio download link generation failed!');
            }

            const downloadUrl = json.data.download_url || json.data.direct_url;
            const finalTitle = json.data.title || videoTitle;
            const thumbnail = json.data.thumbnail || videoThumb;
            const quality = json.data.quality || '320kbps';

            // ලස්සන Straight HUD Details Card එක
            const songCard = `╭───❮ ❖ 𝗛 𝗘 𝗦 𝗛 𝗔 𝗡 - 𝗠 𝗗 ❖ ❯───╮
│  🎵  𝗬 𝗢 𝗨 𝗧 𝗨 𝗕 𝗘  𝗠 𝗨 𝗦 𝗜 𝗖  🎵
│
│ ╭───❮ 🎧 𝗧𝗥𝗔𝗖𝗞 𝗜𝗡𝗙𝗢 ❯────────
│ ├─◈ 🏷️ *Title*    : ${finalTitle}
│ ├─◈ ⏱️ *Duration* : ${duration}
│ ├─◈ 👤 *Artist*   : ${author}
│ ├─◈ 👁️ *Views*    : ${views}
│ ├─◈ 🔊 *Quality*  : ${quality}
│ ╰─────────────────────────────
│
│  > 📥 *Uploading Audio, please wait...*
│  > ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ
╰───────────────────────────────╯`;

            // Thumbnail එක Buffer කර කාඩ් එක යැවීම
            let thumbBuffer;
            try {
                const tRes = await fetch(thumbnail);
                thumbBuffer = await tRes.buffer();
            } catch (e) {
                thumbBuffer = null;
            }

            if (thumbBuffer) {
                await sock.sendMessage(targetChat, {
                    image: thumbBuffer,
                    caption: songCard
                }, { quoted: msg });
            } else {
                await sock.sendMessage(targetChat, { text: songCard }, { quoted: msg });
            }

            // 3. Audio Data Buffer කරගැනීම
            const audioRes = await fetch(downloadUrl);
            const audioBuffer = await audioRes.buffer();

            // 4. Audio File එක සහ Document එක යැවීම
            await sock.sendMessage(targetChat, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${finalTitle}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: finalTitle,
                        body: `Quality: ${quality} | HESHAN-MD`,
                        thumbnailUrl: thumbnail,
                        sourceUrl: videoUrl,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg });

            // 5. අවසානයේ ✅ React කිරීම
            await sock.sendMessage(targetChat, {
                react: { text: "✅", key: msg.key }
            });

        } catch (err) {
            console.error('Song Command Error:', err);
            await sock.sendMessage(targetChat, { 
                text: `❌ *Error:* සිංදුව ලබාගැනීමට නොහැකි විය!\n> ${err.message}` 
            }, { quoted: msg });
        }
    }
};
