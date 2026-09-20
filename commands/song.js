// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ Chamindu API with Auto Fallback Engine
async function getAudioDownloadUrl(videoUrl) {
  // 1. Chamindu API (Primary)
  try {
    const chaminduUrl = `https://api.chamindu.site/api/v1/music/sinhalahitsongs/download?url=${encodeURIComponent(videoUrl)}&api_key=chama_api_ec9848130d1aea209f08fb85e0b4720f`;
    const res = await axios.get(chaminduUrl, { timeout: 12000 });
    
    // Quota ඉවර නැතිනම් සහ direct download url එකක් ලැබුණොත්
    if (res.data?.status && (res.data?.download_url || res.data?.result?.download_url || res.data?.data?.url)) {
      return res.data.download_url || res.data.result?.download_url || res.data.data?.url;
    }
  } catch (e) {
    console.log("Chamindu API Quota/Error, switching to fallback server...");
  }

  // 2. Fallback Option 1: Fast YTMP3 Endpoint
  try {
    const res = await axios.get(`https://api-pink-venom.vercel.app/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
    if (res.data?.result?.download_url || res.data?.download) {
      return res.data.result?.download_url || res.data.download;
    }
  } catch (e) {}

  // 3. Fallback Option 2: BK9 Downloader
  try {
    const res = await axios.get(`https://bk9.fun/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
    if (res.data?.status && res.data?.BK9?.downloadUrl) {
      return res.data.BK9.downloadUrl;
    }
  } catch (e) {}

  // 4. Fallback Option 3: Siputzx Downloader
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
    if (res.data?.status && res.data?.data?.dl) {
      return res.data.data.dl;
    }
  } catch (e) {}

  throw new Error('Download servers සියල්ල කාර්යබහුලයි. කරුණාකර සුළු වේලාවකින් නැවත උත්සාහ කරන්න.');
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3'],
  category: 'download',
  desc: 'Download YouTube song in MP3',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    const query = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    if (!query) {
      return await sock.sendMessage(targetChat, { 
        text: "❗ *කරුණාකර සින්දුවේ නම හෝ YouTube link එකක් ලබාදෙන්න!*\n*උදාහරණ:* `.song Faded`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
      }, { quoted: msg });
    }

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

      // YouTube Search
      if (!isYtUrl) {
        if (!yts) {
          throw new Error('yt-search library missing');
        }

        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('සින්දුව හමු නොවීය. කරුණාකර නම නිවැරදිව ලබාදෙන්න.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title;
        duration = video.timestamp || 'N/A';
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : 'N/A';
      }

      // Fetch download URL (Chamindu -> Fallback)
      const downloadUrl = await getAudioDownloadUrl(videoUrl);
      const cleanTitle = videoTitle.replace(/[\\/:"*?<>|]/g, '').trim();

      const songCard = `╭───❮ 🎵 *H E S H A N - M D* ❯───╮
│
│ 📌 *Title:* ${cleanTitle.slice(0, 38)}
│ 👤 *Artist:* ${author}
│ ⏱️ *Duration:* ${duration}
│ 👁️ *Views:* ${views}
│ 🚀 *Status:* Uploading Audio...
│
╰───────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      // Send Info Card
      try {
        await sock.sendMessage(targetChat, {
          image: { url: thumbnail },
          caption: songCard
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard }, { quoted: msg }).catch(() => {});
      }

      // Delete processing message
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Send MP3 Audio
      await sock.sendMessage(targetChat, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song Command Error:', err?.message || err);
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *Song Error:* ${err?.message || 'Download failed'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡` 
      }, { quoted: msg }).catch(() => {});
    }
  }
};

