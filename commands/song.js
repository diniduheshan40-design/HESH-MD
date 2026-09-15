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
                text: "❗ *කරුණාකර සිංදුවේ නම හෝ Link එකක් ලබාදෙන්න!*\n*උදාහරණ:* `.song Faded`" 
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } });

            let videoUrl = query;
            let videoTitle = query;
            let duration = 'N/A';
            let author = 'HESHAN-MD';
            let thumbnail = 'https://files.catbox.moe/a58add.jpeg';
            let views = 'N/A';

            // YouTube Search & Details Extraction
            if (!query.startsWith('http://') && !query.startsWith('https://')) {
                if (!yts) return await sock.sendMessage(targetChat, { text: "❌ yt-search library එක සොයාගත නොහැකි විය." }, { quoted: msg });
                
                const searchResults = await yts(query);
                if (!searchResults?.videos?.length) {
                    await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } });
                    return await sock.sendMessage(targetChat, { text: "❌ සිංදුව හමු නොවීය!" }, { quoted: msg });
                }

                const video = searchResults.videos[0];
                videoUrl = video.url;
                videoTitle = video.title;
                duration = video.timestamp || 'N/A';
                author = video.author?.name || author;
                thumbnail = video.thumbnail || thumbnail;
                views = video.views ? Number(video.views).toLocaleString() : 'N/A';
            }

            // 1. Audio Stream Link ලබා ගැනීම (Multi-API Fast Fallback)
            let downloadUrl = null;
            let finalTitle = videoTitle;

            const apis = [
                `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=128kbps&api_key=chama_api_b764539713b0514de0dbb60f401cd69e`,
                `https://api.vreden.web.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`,
                `https://widipe.com/download/ytdl?url=${encodeURIComponent(videoUrl)}`
            ];

            for (const endpoint of apis) {
                try {
                    const res = await fetch(endpoint, { timeout: 8000 });
                    const data = await res.json();
                    
                    downloadUrl = data?.data?.download_url || 
                                  data?.data?.direct_url || 
                                  data?.result?.download?.url || 
                                  data?.result?.mp3;

                    if (downloadUrl) {
                        finalTitle = data?.data?.title || data?.result?.title || videoTitle;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!downloadUrl) throw new Error('බාගත කිරීමේ සබැඳිය ලබා ගැනීමට නොහැකි විය.');

            // 2. Info UI Card (Thumbnail එක සමඟ විස්තර පෙන්වීම)
            const songCard = `╭───❮ 🎵 *H E S H A N - M D* ❯───╮
│
│ 📌 *Title:* ${finalTitle.slice(0, 40)}
│ 👤 *Artist:* ${author}
│ ⏱️ *Duration:* ${duration}
│ 👁️ *Views:* ${views}
│ 🔗 *Source:* YouTube Engine
│
│ > ⚡ _Downloading audio file..._
╰───────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

            await sock.sendMessage(targetChat, {
                image: { url: thumbnail },
                caption: songCard
            }, { quoted: msg });

            // 3. Audio එක Background එකෙන් Buffer කර වඩාත් වේගයෙන් යැවීම
            const audioStream = await fetch(downloadUrl);
            const audioBuffer = await audioStream.buffer();

            await sock.sendMessage(targetChat, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${finalTitle.replace(/[\\/:"*?<>|]/g, '')}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: finalTitle.slice(0, 32),
                        body: `${author} • ${duration}`,
                        thumbnailUrl: thumbnail,
                        sourceUrl: videoUrl,
                        mediaType: 2,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg });

            await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error('Song Error:', err);
            await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } });
            await sock.sendMessage(targetChat, { text: `❌ දෝෂයක්: ${err.message}` }, { quoted: msg });
        }
    }
};
