// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ Ultra-Fast Non-Blocking Audio Fetcher (Max 4s per server)
async function getAudioDownloadUrl(videoUrl) {
  // 1. Chamindu API (Strict 4-second timeout to prevent freezing)
  try {
    const chamUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=320kbps&api_key=chama_api_b764539713b0514de0dbb60f401cd69e`;
    const res = await axios.get(chamUrl, { timeout: 4000 });
    
    const dl = res.data?.download_url || 
               res.data?.data?.download_url || 
               res.data?.data?.url || 
               res.data?.result?.download_url || 
               res.data?.result?.url || 
               res.data?.dl;

    if (dl) return dl;
  } catch (e) {
    console.log("Chamindu API skipped (timeout/busy), trying fast mirror...");
  }

  // 2. High-Speed Mirror: Cobalt Web Engine (Instant Stream)
  try {
    const res = await axios.post('https://api.cobalt.tools/api/json', {
      url: videoUrl,
      downloadMode: 'audio',
      audioFormat: 'mp3'
    }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      timeout: 6000
    });
    if (res.data?.url) return res.data.url;
  } catch (e) {}

  // 3. High-Speed Mirror: Siputzx Fast Endpoint
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 6000 });
    if (res.data?.status && res.data?.data?.dl) return res.data.data.dl;
  } catch (e) {}

  // 4. High-Speed Mirror: BK9 Fast Endpoint
  try {
    const res = await axios.get(`https://bk9.fun/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 6000 });
    if (res.data?.status && res.data?.BK9?.downloadUrl) return res.data.BK9.downloadUrl;
  } catch (e) {}

  throw new Error('බාගත කිරීමේ සේවාදායකයන් කාර්යබහුලයි. කරුණාකර නැවත උත්සාහ කරන්න.');
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

      // Search
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

      // Download URL ගන්නා අතරතුර timeout එකකින් freeze වීම වළක්වයි
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

      // Info Card යැවීම
      try {
        await sock.sendMessage(targetChat, {
          image: { url: thumbnail },
          caption: songCard
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard }, { quoted: msg }).catch(() => {});
      }

      // Status message එක delete කිරීම
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Audio Stream එක Direct URL මගින් Delivery කිරීම (RAM freeze නොවේ)
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
        text: `❌ *Song Error:* ${err?.message || 'බාගත කිරීම අසාර්ථක විය'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡` 
      }, { quoted: msg }).catch(() => {});
    }
  }
};

