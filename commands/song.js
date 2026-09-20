// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ Ultra-Resilient Direct Music Engine (Fail-safe Fallbacks)
async function fetchMusicStream(videoUrl) {
  // Option 1: Vepass Direct Cloud
  try {
    const res = await axios.get(`https://api.vepass.top/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 6000 });
    if (res.data?.result?.download_url) return res.data.result.download_url;
  } catch (e) {}

  // Option 2: Okatsu Direct Gateway
  try {
    const res = await axios.get(`https://okatsu-api.vercel.app/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 6000 });
    if (res.data?.dl || res.data?.download) return res.data.dl || res.data.download;
  } catch (e) {}

  // Option 3: Chamindu API Key Fallback
  try {
    const chamUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=320kbps&api_key=chama_api_b764539713b0514de0dbb60f401cd69e`;
    const res = await axios.get(chamUrl, { timeout: 6000 });
    const dl = res.data?.download_url || res.data?.data?.url || res.data?.result?.download_url || res.data?.dl;
    if (dl) return dl;
  } catch (e) {}

  // Option 4: Siputzx Fast
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 6000 });
    if (res.data?.status && res.data?.data?.dl) return res.data.data.dl;
  } catch (e) {}

  throw new Error('All download gateways are busy. Please try again!');
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3'],
  category: 'download',
  desc: 'Download YouTube song with futuristic UI',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    const query = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    if (!query) {
      return await sock.sendMessage(targetChat, { 
        text: `╭───❮ ⚡ *HESHAN-MD MUSIC* ⚡ ❯───╮
│
│ ⚠️ *කරුණාකර සින්දුවේ නම ඇතුළත් කරන්න!*
│ 💡 *උදාහරණ:* \`.song Faded\`
│
╰────────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`
      }, { quoted: msg });
    }

    // Step 1: Futuristic Search Reaction
    sock.sendMessage(targetChat, { react: { text: "🔍", key: msg.key } }).catch(() => {});

    // Step 2: Animated Live Progress Status Message
    let progressMsg = await sock.sendMessage(targetChat, {
      text: `╭───❮ ⚡ *NEURAL AUDIO EXTRACTOR* ⚡ ❯───╮\n│\n│ 📡 *Searching:* _${query}_\n│ ⏳ *Status:* Fetching metadata...\n│\n╰────────────────────────────────╯`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = query;
      let videoTitle = query;
      let duration = '03:45';
      let author = 'YouTube Artist';
      let thumbnail = 'https://files.catbox.moe/a58add.jpeg';
      let views = 'N/A';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library missing');

        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('සින්දුව හමු නොවීය. නම පරීක්ෂා කර නැවත උත්සාහ කරන්න.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : views;
      }

      // Live Update Progress
      sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});
      if (progressMsg?.key) {
        await sock.sendMessage(targetChat, {
          text: `╭───❮ ⚡ *NEURAL AUDIO EXTRACTOR* ⚡ ❯───╮\n│\n│ 🎵 *Track:* _${videoTitle.slice(0, 32)}..._\n│ 🚀 *Status:* Injecting 320kbps stream...\n│\n╰────────────────────────────────╯`,
          edit: progressMsg.key
        }).catch(() => {});
      }

      const downloadUrl = await fetchMusicStream(videoUrl);
      const cleanTitle = videoTitle.replace(/[\\/:"*?<>|]/g, '').trim();

      // Futuristic Cyber-Banner Card
      const musicBanner = `╭───────❮ 🎵 *HESHAN-MD PRO AUDIO* ❯───────╮
│
├ 🏷️ *Title    :* ${cleanTitle.slice(0, 35)}
├ 🎙️ *Artist   :* ${author}
├ ⏱️ *Duration :* ${duration}
├ 👁️ *Views    :* ${views}
├ ⚡ *Bitrate  :* 320kbps Ultra-HD
│
╰──────────────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

      // Card dispatch
      try {
        await sock.sendMessage(targetChat, {
          image: { url: thumbnail },
          caption: musicBanner
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: musicBanner }, { quoted: msg }).catch(() => {});
      }

      // Live Progress Done Delete
      if (progressMsg?.key) {
        sock.sendMessage(targetChat, { delete: progressMsg.key }).catch(() => {});
      }

      // Audio Delivery: Direct URL with Stream MIME (WhatsApp player auto-render)
      await sock.sendMessage(targetChat, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
        ptt: false
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song command failure:', err?.message || err);
      if (progressMsg?.key) {
        sock.sendMessage(targetChat, { delete: progressMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *Audio Extraction Failed:* සර්වර් එක කාර්යබහුලයි. සුළු වේලාවකින් නැවත උත්සාහ කරන්න.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡` 
      }, { quoted: msg }).catch(() => {});
    }
  }
};

