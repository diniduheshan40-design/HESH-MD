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

    // Instant Non-blocking Reaction
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
        if (!yts) throw new Error('yt-search module not available');
        
        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('සින්දුව හමු නොවීය. නම නිවැරදි දැයි පරීක්ෂා කරන්න.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title;
        duration = video.timestamp || 'N/A';
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : 'N/A';
      }

      let audioUrl = null;
      let finalTitle = videoTitle;

      // ⚡ 100% Active Multi-Engine MP3 Extractor Pool (Fast Fallbacks)
      const extractEngines = [
        // Engine 1: BK9 YouTube API
        async () => {
          const res = await axios.get(`https://bk9.fun/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 10000 });
          if (res.data?.status && res.data?.BK9?.downloadUrl) {
            return res.data.BK9.downloadUrl;
          }
          throw new Error('BK9 failed');
        },
        // Engine 2: Siputzx Direct API
        async () => {
          const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 10000 });
          if (res.data?.status && res.data?.data?.dl) {
            return res.data.data.dl;
          }
          throw new Error('Siputzx failed');
        },
        // Engine 3: GuruAPI Engine
        async () => {
          const res = await axios.get(`https://api.guruapi.tech/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 10000 });
          if (res.data?.result?.downloadUrl) {
            return res.data.result.downloadUrl;
          }
          throw new Error('GuruAPI failed');
        },
        // Engine 4: Okatsu Downloader
        async () => {
          const res = await axios.get(`https://api.okatsu.my.id/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 10000 });
          if (res.data?.status && res.data?.result?.downloadUrl) {
            return res.data.result.downloadUrl;
          }
          throw new Error('Okatsu failed');
        }
      ];

      for (const engine of extractEngines) {
        try {
          audioUrl = await engine();
          if (audioUrl && typeof audioUrl === 'string' && audioUrl.startsWith('http')) {
            break;
          }
        } catch (e) {}
      }

      if (!audioUrl) {
        throw new Error('Download servers are currently overloaded. Please try again!');
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

      // 1. Thumbnail Image Card එක යැවීම
      try {
        await sock.sendMessage(targetChat, {
          image: { url: thumbnail },
          caption: songCard
        }, { quoted: msg });
      } catch (imgErr) {
        await sock.sendMessage(targetChat, { text: songCard }, { quoted: msg }).catch(() => {});
      }

      // 2. Direct Audio Stream Upload (Direct URL inject via Baileys)
      await sock.sendMessage(targetChat, {
        audio: { url: audioUrl },
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`
      }, { quoted: msg });

      // 3. Audio එක ගිය පසු Alert Message එක delete කිරීම
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song Command Error:', err?.message || err);
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *Song Error:* ${err?.message || 'Download failed'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡` 
      }, { quoted: msg });
    }
  }
};

