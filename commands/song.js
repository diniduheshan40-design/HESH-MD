// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ Dynamic Stream Extractor
async function fetchSongAudioUrl(videoUrl) {
  const cleanUrl = encodeURIComponent(videoUrl);

  // 1. Thinuzz API (Primary)
  try {
    const thinUrl = `https://mr-thinuzz-api-build.vercel.app/api/ytmp3/download?url=${cleanUrl}&apiKey=key_525b5ceb068ac7f2`;
    const res = await axios.get(thinUrl, { timeout: 12000 });
    const data = res.data;
    const dl = data?.result?.download_url || 
               data?.result?.url || 
               data?.result?.dl || 
               data?.data?.download_url || 
               data?.data?.url || 
               data?.download_url || 
               data?.url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 2. High Speed Fallback: Ryzendesu
  try {
    const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp3?url=${cleanUrl}`, { timeout: 10000 });
    const dl = res.data?.url || res.data?.downloadUrl;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 3. High Speed Fallback: Siputzx
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${cleanUrl}`, { timeout: 10000 });
    const dl = res.data?.data?.dl || res.data?.data?.download_url || res.data?.download_url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 4. High Speed Fallback: Widipe
  try {
    const res = await axios.get(`https://widipe.com/download/ytdl?url=${cleanUrl}`, { timeout: 10000 });
    const dl = res.data?.result?.mp3 || res.data?.result?.download;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  throw new Error('බාගත කිරීමට හැකි සබැඳියක් හමු නොවීය.');
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

    // ⚡ Channel Forward Badge (Image Card එකට පමණි)
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
        text: `╭───❮ 🎵 *HESHAN-MD MUSIC* ❯───╮\n│\n│ ⚠️ *කරුණාකර සින්දුවේ නම හෝ Link එකක් ලබාදෙන්න!*\n│ 💡 *උදාහරණ:* \`.song Lelena\`\n│\n╰────────────────────────────────╯\n> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    // පොඩි Waiting Message එක
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

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library missing');

        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('සින්දුව සොයාගත නොහැකි විය.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || query;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : views;
      }

      // Download URL ලබා ගැනීම
      const rawAudioUrl = await fetchSongAudioUrl(videoUrl);
      const cleanTitle = videoTitle.replace(/[\\/:"*?<>|]/g, '').trim();

      // Waiting message එක ක්ෂණිකව Delete කිරීම
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Song Details Card
      const songCard = `╭──────❮ 🎵 *HESHAN-MD MUSIC* ❯──────╮
│
├ 🏷️ *Title    :* ${cleanTitle.slice(0, 36)}
├ 👤 *Artist   :* ${author}
├ ⏱️ *Duration :* ${duration}
├ 👁️ *Views    :* ${views}
├ ⚡ *Quality  :* 320kbps Audio
│
╰────────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

      // Card එක Channel Forward Badge එක සහිතව යැවීම
      try {
        await sock.sendMessage(targetChat, {
          image: { url: thumbnail },
          caption: songCard,
          contextInfo: channelContext
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard, contextInfo: channelContext }, { quoted: msg }).catch(() => {});
      }

      // Audio එක Direct Stream URL ලෙස යැවීම (RAM Drop වීම වළක්වයි)
      await sock.sendMessage(targetChat, {
        audio: { url: rawAudioUrl },
        mimetype: 'audio/mp4',
        fileName: `${cleanTitle}.mp3`,
        ptt: false
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song command error:', err?.message || err);

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

