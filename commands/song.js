// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ 100% Working YouTube MP3 Link Extractors (Direct Mirrors)
async function fetchSongAudioUrl(videoUrl) {
  const cleanUrl = encodeURIComponent(videoUrl);

  // 1. Ryzendesu Downloader API
  try {
    const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp3?url=${cleanUrl}`, { timeout: 10000 });
    const dl = res.data?.url || res.data?.downloadUrl || res.data?.link;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 2. Siputzx Fast Endpoint
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${cleanUrl}`, { timeout: 10000 });
    const dl = res.data?.data?.dl || res.data?.data?.download_url || res.data?.download_url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 3. Widipe Engine
  try {
    const res = await axios.get(`https://widipe.com/download/ytdl?url=${cleanUrl}`, { timeout: 10000 });
    const dl = res.data?.result?.mp3 || res.data?.result?.download;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 4. David Cyril Mirror
  try {
    const res = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp3?url=${cleanUrl}`, { timeout: 10000 });
    const dl = res.data?.result?.download_url || res.data?.result?.url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 5. Ytdl Cobalt Service
  try {
    const res = await axios.post('https://co.wuk.sh/api/json', {
      url: videoUrl,
      isAudioOnly: true,
      aFormat: 'mp3'
    }, {
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      timeout: 10000
    });
    const dl = res.data?.url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  throw new Error('සින්දුව බාගත කිරීමට Links සොයාගත නොහැකි විය.');
}

// ⚡ Convert Audio URL to Direct Buffer (Fixes Baileys Audio Drop)
async function downloadToBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  return Buffer.from(response.data);
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3'],
  category: 'download',
  desc: 'Download YouTube songs in high quality MP3',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // ⚡ Newsletter Forward Badge (කාඩ් එකට පමණක්)
    const channelContext = global.channelContext?.contextInfo || {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363421906774107@newsletter',
        newsletterName: '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨',
        serverMessageId: 1
      }
    };

    const query = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    if (!query) {
      return await sock.sendMessage(targetChat, { 
        text: `╭───❮ 🎵 *HESHAN-MD MUSIC* ❯───╮
│
│ ⚠️ *කරුණාකර සින්දුවේ නම හෝ Link එකක් ලබාදෙන්න!*
│ 💡 *උදාහරණ:* \`.song Faded\`
│
╰────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    // Step 1: Instant reaction
    sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    // Step 2: Waiting message
    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⏳ *පොඩ්ඩක් ඉන්න සුදු මැණික...*\nඔයා ඉල්ලපු *"${query}"* සින්දුව බාගත කරමින් පවතී... 🎵`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = query;
      let videoTitle = query;
      let duration = 'N/A';
      let author = 'YouTube Music';
      let thumbnail = 'https://files.catbox.moe/a58add.jpeg';
      let views = 'N/A';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      // Search via yt-search
      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search package එක නොමැත.');

        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('සින්දුව සොයාගත නොහැකි විය. නම නිවැරදිදැයි බලන්න.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || query;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : views;
      }

      // Step 3: Fetch Audio Stream
      const rawAudioUrl = await fetchSongAudioUrl(videoUrl);
      const audioBuffer = await downloadToBuffer(rawAudioUrl);
      const cleanTitle = videoTitle.replace(/[\\/:"*?<>|]/g, '').trim();

      // Step 4: Delete waiting message
      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Step 5: Details Card with Channel Context Badge
      const songCard = `╭──────❮ 🎵 *HESHAN-MD MUSIC* ❯──────╮
│
├ 🏷️ *Title    :* ${cleanTitle.slice(0, 36)}
├ 👤 *Artist   :* ${author}
├ ⏱️ *Duration :* ${duration}
├ 👁️ *Views    :* ${views}
├ ⚡ *Quality  :* 320kbps High Quality
│
╰────────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

      try {
        await sock.sendMessage(targetChat, {
          image: { url: thumbnail },
          caption: songCard,
          contextInfo: channelContext
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard, contextInfo: channelContext }, { quoted: msg }).catch(() => {});
      }

      // Step 6: Dispatch Audio as a Direct Buffer
      await sock.sendMessage(targetChat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
        ptt: false
      }, { quoted: msg });

      // Step 7: Success Reaction
      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song command execution error:', err?.message || err);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      
      await sock.sendMessage(targetChat, { 
        text: `❌ *දෝෂයක් සිදු විය:* ${err?.message || 'සින්දුව ලබා ගැනීමට නොහැකි විය.'}\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`
      }, { quoted: msg }).catch(() => {});
    }
  }
};

