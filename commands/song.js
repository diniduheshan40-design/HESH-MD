// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ Solid Fallback YouTube Audio Fetcher
async function getAudioDownloadUrl(videoUrl) {
  // 1. Cobalt Global Engine (High Speed / No Limits)
  try {
    const res = await axios.post('https://api.cobalt.tools/api/json', {
      url: videoUrl,
      downloadMode: 'audio',
      audioFormat: 'mp3'
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    if (res.data?.url) return res.data.url;
  } catch (e) {}

  // 2. Okatsu Proxy Engine
  try {
    const res = await axios.get(`https://okatsu-api.vercel.app/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
    if (res.data?.dl || res.data?.download) return res.data.dl || res.data.download;
  } catch (e) {}

  // 3. Vepass Fast API
  try {
    const res = await axios.get(`https://api.vepass.top/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
    if (res.data?.result?.download_url) return res.data.result.download_url;
  } catch (e) {}

  // 4. Chamindu API (Primary User Key Fallback)
  try {
    const chaminduUrl = `https://api.chamindu.site/api/v1/music/sinhalahitsongs/download?url=${encodeURIComponent(videoUrl)}&api_key=chama_api_ec9848130d1aea209f08fb85e0b4720f`;
    const res = await axios.get(chaminduUrl, { timeout: 10000 });
    if (res.data?.status && (res.data?.download_url || res.data?.result?.download_url)) {
      return res.data.download_url || res.data.result.download_url;
    }
  } catch (e) {}

  throw new Error('All download gateways are temporarily blocked by YouTube. Please try another song title.');
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

    const statusMsg = await sock.sendMessage(targetChat, {
      text: "⚡ *Downloading audio stream, please wait...*"
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
        if (!yts) throw new Error('yt-search library missing');

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

      const downloadUrl = await getAudioDownloadUrl(videoUrl);
      const cleanTitle = videoTitle.replace(/[\\/:"*?<>|]/g, '').trim();

      const songCard = `╭───❮ 🎵 *H E S H A N - M D* ❯───╮
│
│ 📌 *Title:* ${cleanTitle.slice(0, 38)}
│ 👤 *Artist:* ${author}
│ ⏱️ *Duration:* ${duration}
│ 👁️ *Views:* ${views}
│ 🚀 *Status:* Sending Audio...
│
╰───────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      try {
        await sock.sendMessage(targetChat, {
          image: { url: thumbnail },
          caption: songCard
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard }, { quoted: msg }).catch(() => {});
      }

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Audio file dispatch with stream buffer fallback
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

