// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ Active Chamindu 320kbps Engine with Multi-Fallbacks
async function getAudioDownloadUrl(videoUrl) {
  // 1. Chamindu Dedicated API (Primary - 320kbps)
  try {
    const chamUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=320kbps&api_key=chama_api_b764539713b0514de0dbb60f401cd69e`;
    const res = await axios.get(chamUrl, { timeout: 15000 });
    
    const dl = res.data?.download_url || 
               res.data?.data?.download_url || 
               res.data?.data?.url || 
               res.data?.result?.download_url || 
               res.data?.result?.url || 
               res.data?.dl;

    if (dl) return dl;
  } catch (e) {
    console.error("Chamindu API primary failed, trying backup:", e.message);
  }

  // 2. High-Speed Fallback 1 (Okatsu Engine)
  try {
    const res = await axios.get(`https://okatsu-api.vercel.app/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 12000 });
    if (res.data?.dl || res.data?.download) return res.data.dl || res.data.download;
  } catch (e) {}

  // 3. High-Speed Fallback 2 (BK9 Global Gateway)
  try {
    const res = await axios.get(`https://bk9.fun/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 12000 });
    if (res.data?.status && res.data?.BK9?.downloadUrl) return res.data.BK9.downloadUrl;
  } catch (e) {}

  // 4. High-Speed Fallback 3 (Siputzx Engine)
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 12000 });
    if (res.data?.status && res.data?.data?.dl) return res.data.data.dl;
  } catch (e) {}

  throw new Error('බාගත කිරීමේ සේවාදායකයන් කාර්යබහුලයි. කරුණාකර නැවත උත්සාහ කරන්න.');
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3'],
  category: 'download',
  desc: 'Download YouTube song in MP3 320kbps',

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

    // Reaction
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

      // YouTube Search
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
│ 🎧 *Quality:* 320kbps
│ 🚀 *Status:* Sending Audio...
│
╰───────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      // 1. Info Card එක යැවීම (Fail වුවහොත් Plain text)
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

      // 2. Audio Stream එක Direct Buffer එකක් ලෙස download කර යැවීම (Zero Drop)
      let audioPayload;
      try {
        const audioStream = await axios.get(downloadUrl, { 
          responseType: 'arraybuffer',
          timeout: 45000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        audioPayload = { audio: Buffer.from(audioStream.data) };
      } catch (bufErr) {
        // Buffer download fail වුවහොත් direct URL fallback
        audioPayload = { audio: { url: downloadUrl } };
      }

      await sock.sendMessage(targetChat, {
        ...audioPayload,
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

