// commands/song.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3'],
  category: 'download',
  desc: 'Download YouTube song in MP3',

  async execute(sock, msg, args, chatJid) {
    const targetChat = chatJid || msg.key.remoteJid;
    const query = args.join(' ').trim();

    if (!query) {
      return await sock.sendMessage(targetChat, { 
        text: "❗ *Please provide a song name or link!*\n*Example:* `.song Faded`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
      }, { quoted: msg });
    }

    let statusMsg = null;
    let tempFilePath = null;

    // Fast Non-blocking Reaction
    sock.sendMessage(targetChat, { react: { text: "🎵", key: msg.key } }).catch(() => {});

    try {
      statusMsg = await sock.sendMessage(targetChat, {
        text: "⚡ *Downloading your song, please wait...*"
      }, { quoted: msg });

      let videoUrl = query;
      let videoTitle = query;
      let duration = 'N/A';
      let author = 'YouTube Music';
      let thumbnail = 'https://files.catbox.moe/a58add.jpeg';
      let views = 'N/A';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search module not installed');
        
        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('Song not found! Please check the title.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title;
        duration = video.timestamp || 'N/A';
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : 'N/A';
      }

      let downloadUrl = null;
      let finalTitle = videoTitle;

      // ⚡ Robust Multi-Engine MP3 Extractor Pool
      const extractors = [
        // Source 1: Gifted / NexOracle API
        async () => {
          const res = await axios.get(`https://api.nexoracle.com/downloader/yt-audio?apikey=free_key@maher_apis&url=${encodeURIComponent(videoUrl)}`, { timeout: 8000 });
          if (res.data?.result?.url) return res.data.result.url;
          throw new Error('NexOracle failed');
        },
        // Source 2: Chamindu API
        async () => {
          const res = await axios.get(`https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=128kbps&api_key=chama_api_b764539713b0514de0dbb60f401cd69e`, { timeout: 8000 });
          const url = res.data?.data?.download_url || res.data?.data?.direct_url;
          if (url) return url;
          throw new Error('Chamindu failed');
        },
        // Source 3: David Cyril Engine
        async () => {
          const res = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 8000 });
          if (res.data?.result?.download_url) return res.data.result.download_url;
          throw new Error('David Cyril failed');
        },
        // Source 4: Widipe Audio Engine
        async () => {
          const res = await axios.get(`https://widipe.com/download/ytdl?url=${encodeURIComponent(videoUrl)}`, { timeout: 8000 });
          if (res.data?.result?.mp3) return res.data.result.mp3;
          throw new Error('Widipe failed');
        }
      ];

      for (const extractor of extractors) {
        try {
          const result = await extractor();
          if (result && typeof result === 'string' && result.startsWith('http')) {
            downloadUrl = result;
            break;
          }
        } catch (e) {}
      }

      if (!downloadUrl) {
        throw new Error('All audio download servers are busy. Please try again in a moment.');
      }

      // Safe Non-Blocking File Pipeline (WhatsApp download hang වීම වළක්වයි)
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      tempFilePath = path.join(tempDir, `song_${Date.now()}.mp3`);

      const audioStream = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 45000
      });

      await pipeline(audioStream.data, fs.createWriteStream(tempFilePath));

      // Alert Message delete කිරීම
      if (statusMsg) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      const cleanTitle = finalTitle.replace(/[\\/:"*?<>|]/g, '').trim();
      const songCard = `╭───❮ 🎵 *H E S H A N - M D* ❯───╮
│
│ 📌 *Title:* ${cleanTitle.slice(0, 38)}
│ 👤 *Artist:* ${author}
│ ⏱️ *Duration:* ${duration}
│ 👁️ *Views:* ${views}
│ 🚀 *Engine:* High-Speed Audio
│
╰───────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      // Thumbnail Image Card එක යැවීම
      try {
        await sock.sendMessage(targetChat, {
          image: { url: thumbnail },
          caption: songCard
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard }, { quoted: msg }).catch(() => {});
      }

      // ⚡ Direct File Audio Upload (100% Reliable & Fast)
      await sock.sendMessage(targetChat, {
        audio: { url: tempFilePath },
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`
      });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song Error:', err?.message || err);
      if (statusMsg) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *Song Error:* ${err?.message || 'Download failed'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡` 
      }, { quoted: msg });
    } finally {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.promises.unlink(tempFilePath).catch(() => {});
      }
    }
  }
};

