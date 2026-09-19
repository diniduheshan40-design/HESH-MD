// commands/song.js
const axios = require('axios');
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

    // Non-blocking reaction
    sock.sendMessage(targetChat, { react: { text: "🎵", key: msg.key } }).catch(() => {});

    let statusMsg = await sock.sendMessage(targetChat, {
      text: "⚡ *Downloading your song, please wait...*"
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = query;
      let videoTitle = query;
      let duration = 'N/A';
      let author = 'YouTube Music';
      let thumbnail = 'https://files.catbox.moe/a58add.jpeg';
      let views = 'N/A';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search package is missing');
        
        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('සින්දුව හමු නොවීය. කරුණාකර නිවැරදි නම ඇතුළත් කරන්න.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title;
        duration = video.timestamp || 'N/A';
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : 'N/A';
      }

      let audioBuffer = null;
      let finalTitle = videoTitle;

      // ⚡ Fast Working Audio API Pipeline (Buffer directly in memory)
      const downloadSources = [
        // Source 1: Dark-Yasiya Audio API
        async () => {
          const res = await axios.get(`https://www.dark-yasiya-api.site/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 12000 });
          const dlUrl = res.data?.result?.dl_link || res.data?.result?.download;
          if (!dlUrl) throw new Error('Yasiya link missing');
          const audioStream = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 25000 });
          return Buffer.from(audioStream.data);
        },
        // Source 2: NexOracle Engine
        async () => {
          const res = await axios.get(`https://api.nexoracle.com/downloader/yt-audio?apikey=free_key@maher_apis&url=${encodeURIComponent(videoUrl)}`, { timeout: 12000 });
          const dlUrl = res.data?.result?.url;
          if (!dlUrl) throw new Error('NexOracle link missing');
          const audioStream = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 25000 });
          return Buffer.from(audioStream.data);
        },
        // Source 3: David Cyril Engine
        async () => {
          const res = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 12000 });
          const dlUrl = res.data?.result?.download_url;
          if (!dlUrl) throw new Error('David Cyril link missing');
          const audioStream = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 25000 });
          return Buffer.from(audioStream.data);
        }
      ];

      for (const getAudio of downloadSources) {
        try {
          audioBuffer = await getAudio();
          if (audioBuffer && audioBuffer.length > 10000) break;
        } catch (err) {
          // Fallback to next engine
        }
      }

      if (!audioBuffer) {
        throw new Error('Audio download server busy! කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.');
      }

      const cleanTitle = finalTitle.replace(/[\\/:"*?<>|]/g, '').trim();

      // Thumbnail Image Card
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

      // Card එක යැවීම
      await sock.sendMessage(targetChat, {
        image: { url: thumbnail },
        caption: songCard
      }, { quoted: msg }).catch(() => {});

      // ⚡ Direct In-Memory Audio Upload (කවදාවත් හිරවෙන්නේ නැත)
      await sock.sendMessage(targetChat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`
      }, { quoted: msg });

      // Clean Alert Message
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song Download Error:', err?.message || err);
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *Song Error:* ${err?.message || 'Download error'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡` 
      }, { quoted: msg });
    }
  }
};

