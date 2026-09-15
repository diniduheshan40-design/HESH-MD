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
                text: "❗ *කරුණාකර සිංදුවේ නම හෝ Link එකක් දෙන්න!*\n*උදාහරණ:* `.song Faded`" 
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } });

            let videoUrl = query;
            let videoTitle = query;
            let duration = 'N/A';
            let author = 'HESHAN-MD';

            // YouTube Search
            if (!query.startsWith('http://') && !query.startsWith('https://')) {
                if (!yts) return await sock.sendMessage(targetChat, { text: "❌ yt-search library එක නැත." }, { quoted: msg });
                const searchResults = await yts(query);
                if (!searchResults?.videos?.length) {
                    return await sock.sendMessage(targetChat, { text: "❌ සිංදුව හමු නොවීය!" }, { quoted: msg });
                }
                const video = searchResults.videos[0];
                videoUrl = video.url;
                videoTitle = video.title;
                duration = video.timestamp || 'N/A';
                author = video.author?.name || author;
            }

            // 128kbps මඟින් size එක 70% කින් අඩු කර Speed එක 3x වැඩි කරයි
            const apiKey = 'chama_api_b764539713b0514de0dbb60f401cd69e';
            const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=128kbps&api_key=${apiKey}`;

            let downloadUrl;
            let finalTitle = videoTitle;

            try {
                const res = await fetch(apiUrl);
                const json = await res.json();
                if (json?.status && (json.data?.download_url || json.data?.direct_url)) {
                    downloadUrl = json.data.download_url || json.data.direct_url;
                    finalTitle = json.data.title || videoTitle;
                }
            } catch (e) {
                // Main API එක slow/down නම් Fast Backup API එකක්
                const backup = await fetch(`https://api.vreden.web.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`);
                const bJson = await backup.json();
                downloadUrl = bJson?.result?.download?.url;
            }

            if (!downloadUrl) throw new Error('බාගත කිරීමේ Link එක ලබාගත නොහැකි විය.');

            // Image කාඩ් යැවීම නවතා Audio එක කෙලින්ම යැවීම (Speed උපරිම වේ)
            await sock.sendMessage(targetChat, {
                audio: { url: downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${finalTitle}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        title: finalTitle.slice(0, 30),
                        body: `${author} • ${duration}`,
                        mediaType: 1,
                        renderLargerThumbnail: false,
                        sourceUrl: videoUrl
                    }
                }
            }, { quoted: msg });

            await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } });

        } catch (err) {
            console.error('Song Error:', err);
            await sock.sendMessage(targetChat, { text: `❌ දෝෂයක්: ${err.message}` }, { quoted: msg });
        }
    }
};
