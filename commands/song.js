// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ Multi-Stream Robust YouTube MP3 Extractor
async function fetchSongAudio(videoUrl) {
  const cleanUrl = encodeURIComponent(videoUrl);

  // 1. Chamindu 320kbps API Gateway (Fast Timeout)
  try {
    const chamUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${cleanUrl}&quality=320kbps&api_key=chama_api_b764539713b0514de0dbb60f401cd69e`;
    const res = await axios.get(chamUrl, { timeout: 6000 });
    const dl = res.data?.download_url || 
               res.data?.data?.download_url || 
               res.data?.data?.url || 
               res.data?.result?.download_url || 
               res.data?.result?.url || 
               res.data?.dl;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 2. High-Speed Mirror: Vepass Engine
  try {
    const res = await axios.get(`https://api.vepass.top/api/ytmp3?url=${cleanUrl}`, { timeout: 6000 });
    const dl = res.data?.result?.download_url || res.data?.download_url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 3. High-Speed Mirror: Okatsu Gateway
  try {
    const res = await axios.get(`https://okatsu-api.vercel.app/api/ytmp3?url=${cleanUrl}`, { timeout: 6000 });
    const dl = res.data?.dl || res.data?.download;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 4. High-Speed Mirror: Siputzx Fast Endpoint
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${cleanUrl}`, { timeout: 6000 });
    const dl = res.data?.data?.dl || res.data?.download_url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  throw new Error('All download gateways are temporarily busy. Please retry shortly.');
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3'],
  category: 'download',
  desc: 'Download YouTube song in MP3 with live status and channel badge',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // ⚡ Global Newsletter Forward Badge (✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨)
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
│ ⚠️ *Please provide a song title or YouTube link!*
│ 💡 *Example:* \`.song Faded\`
│
╰────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    // Step 1: Instant reaction 🎵
    sock.sendMessage(targetChat, { react: { text: "🎵", key: msg.key } }).catch(() => {});

    // Step 2: Beautiful English waiting message
    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Searching for "${query}"...*\nPlease hold on for a moment while we process your request. ⏳`,
      contextInfo: channelContext
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = query;
      let videoTitle = query;
      let duration = 'N/A';
      let author = 'YouTube Music';
      let thumbnail = 'https://files.catbox.moe/a58add.jpeg';
      let views = 'N/A';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      // Search if query is not a direct URL
      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library missing');

        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('Song not found! Please check the title and try again.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || query;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : views;
      }

      // Download audio URL
      const downloadUrl = await fetchSongAudio(videoUrl);
      const cleanTitle = videoTitle.replace(/[\\/:"*?<>|]/g, '').trim();

      // Step 3: Message edit to English "Here is your requested song!"
      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, {
          text: `✨ *Here is your requested song! Delivering high quality audio now...* 🎧`,
          edit: statusMsg.key
        }).catch(() => {});
      }

      // Step 4: Song Details Card
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
      } catch (imgErr) {
        await sock.sendMessage(targetChat, {
          text: songCard,
          contextInfo: channelContext
        }, { quoted: msg }).catch(() => {});
      }

      // Step 5: Audio dispatch with WhatsApp player support
      await sock.sendMessage(targetChat, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
        ptt: false,
        contextInfo: channelContext
      }, { quoted: msg });

      // Clean up waiting message
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Step 6: Success reaction ✅
      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song command execution error:', err?.message || err);
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *Error:* ${err?.message || 'Download failed. Please try again!'}\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};

