// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

const CHAMINDU_API_KEY = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';

// Extract Video ID
function extractYouTubeId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// Chamindu API Engine
async function fetchAudioFromChamindu(videoUrl, quality = '320kbps') {
  const cleanQuality = quality.replace(/[^0-9]/g, '') + 'kbps';
  const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=${cleanQuality}&format=mp3&api_key=${CHAMINDU_API_KEY}`;

  const res = await axios.get(apiUrl, { timeout: 35000 });
  const data = res.data?.data || res.data;

  const dlUrl = data?.direct_url || data?.download_url;
  if (!dlUrl) throw new Error('Download URL generated failed from Chamindu API.');

  return {
    downloadUrl: dlUrl,
    title: data?.title || 'YouTube Audio',
    thumbnail: data?.thumbnail || `https://i.ytimg.com/vi/${extractYouTubeId(videoUrl)}/hqdefault.jpg`,
    quality: data?.quality || cleanQuality
  };
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3', 'ytmp3'],
  category: 'download',
  desc: 'Download YouTube audio with quality selection',

  async execute(sock, msg, args, chatJid) {
    const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';

    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    const channelContext = global.channelContext?.contextInfo || {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363421906774107@newsletter',
        newsletterName: '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨',
        serverMessageId: 1
      }
    };

    let rawInput = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    if (!rawInput) {
      return await sock.sendMessage(targetChat, { 
        text: `╭───❮ 🎵 *HESHAN-MD MUSIC* ❯───╮\n│\n│ ⚠️ *කරුණාකර සින්දුවේ නම හෝ Link එකක් ලබාදෙන්න!*\n│ 💡 *භාවිතය:* \`.song Lelena\`\n│ 💡 *Quality සමඟ:* \`.song Lelena -320k\`\n│     *(128k, 192k, 320k)*\n│\n╰────────────────────────────────╯${DEFAULT_FOOTER}`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    // Check custom quality (Default 320kbps)
    let selectedQuality = '320kbps';
    const qualityMatch = rawInput.match(/-(128k|192k|320k)/i);
    if (qualityMatch) {
      selectedQuality = qualityMatch[1].toLowerCase() + 'bps';
      rawInput = rawInput.replace(qualityMatch[0], '').trim();
    }

    sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Searching & Fetching Audio [${selectedQuality}]...*\nPlease hold on a moment. 🎵`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = rawInput;
      let videoTitle = rawInput;
      let duration = 'N/A';
      let views = 'N/A';
      let author = 'YouTube Music';
      let thumb = 'https://files.catbox.moe/a58add.jpeg';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(rawInput);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library is missing.');
        const searchResults = await yts(rawInput);
        if (!searchResults?.videos?.length) {
          throw new Error('Song not found! Please check the title and try again.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || rawInput;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumb = video.thumbnail || thumb;
        views = video.views ? Number(video.views).toLocaleString() : views;
      }

      // Step 1: Chamindu API එකෙන් Download URL ගැනීම
      const songData = await fetchAudioFromChamindu(videoUrl, selectedQuality);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      // Step 2: Audio Buffer එක බාගත කිරීම
      const audioRes = await axios.get(songData.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const audioBuffer = Buffer.from(audioRes.data);

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Step 3: Card එක යැවීම
      const songCard = `╭──────❮ 🎵 *HESHAN-MD MUSIC* ❯──────╮
│
├ 🏷️ *Title    :* ${cleanTitle.slice(0, 36)}
├ 👤 *Artist   :* ${author}
├ ⏱️ *Duration :* ${duration}
├ 👁️ *Views    :* ${views}
├ ⚡ *Quality  :* ${songData.quality}
├ 🚀 *Engine   :* 10Gbps Chamindu CDN
│
╰────────────────────────────────────╯${DEFAULT_FOOTER}`.trim();

      try {
        await sock.sendMessage(targetChat, {
          image: { url: songData.thumbnail || thumb },
          caption: songCard,
          contextInfo: channelContext
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard, contextInfo: channelContext }, { quoted: msg }).catch(() => {});
      }

      // Step 4: Audio File එක යැවීම
      await sock.sendMessage(targetChat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
        ptt: false
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song Download Error:', err.message);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, { 
        text: `❌ *Error:* ${err.message}${DEFAULT_FOOTER}`
      }, { quoted: msg }).catch(() => {});
    }
  }
};

