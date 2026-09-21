// commands/video.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

const CHAMINDU_API_KEY = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';

function extractYouTubeId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// Chamindu Video Engine
async function fetchVideoFromChamindu(videoUrl, quality = '720p') {
  const cleanQuality = quality.toLowerCase().replace(/[^0-9]/g, '') + 'p';
  const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=${cleanQuality}&format=mp4&api_key=${CHAMINDU_API_KEY}`;

  const res = await axios.get(apiUrl, { timeout: 45000 });
  const data = res.data?.data || res.data;

  const dlUrl = data?.direct_url || data?.download_url;
  if (!dlUrl) throw new Error('Video URL generation failed from Chamindu API.');

  return {
    downloadUrl: dlUrl,
    title: data?.title || 'YouTube Video',
    thumbnail: data?.thumbnail || `https://i.ytimg.com/vi/${extractYouTubeId(videoUrl)}/hqdefault.jpg`,
    quality: data?.quality || cleanQuality
  };
}

module.exports = {
  name: 'video',
  alias: ['ytmp4', 'ytvideo', 'ytv', 'mp4'],
  category: 'download',
  desc: 'Download YouTube videos with quality selection (360p, 720p, 1080p)',

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
        text: `╭───❮ 🎬 *HESHAN-MD VIDEO* ❯───╮\n│\n│ ⚠️ *කරුණාකර Video නම හෝ Link එකක් ලබාදෙන්න!*\n│ 💡 *භාවිතය:* \`.video Shape of You\`\n│ 💡 *Quality සමඟ:* \`.video Shape of You -1080p\`\n│     *(360p, 480p, 720p, 1080p)*\n│\n╰────────────────────────────────╯${DEFAULT_FOOTER}`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    // Check Quality (Default 720p)
    let selectedQuality = '720p';
    const qualityMatch = rawInput.match(/-(360p|480p|720p|1080p)/i);
    if (qualityMatch) {
      selectedQuality = qualityMatch[1].toLowerCase();
      rawInput = rawInput.replace(qualityMatch[0], '').trim();
    }

    sock.sendMessage(targetChat, { react: { text: "🎬", key: msg.key } }).catch(() => {});

    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Downloading "${rawInput}" in [${selectedQuality}]...*\n10Gbps CDN එකෙන් download වෙමින් පවතී. ⏳`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = rawInput;
      let videoTitle = rawInput;
      let duration = 'N/A';
      let views = 'N/A';
      let author = 'YouTube Creator';
      let thumb = 'https://files.catbox.moe/a58add.jpeg';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(rawInput);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library is missing.');
        const searchResults = await yts(rawInput);
        if (!searchResults?.videos?.length) {
          throw new Error('Video not found! Please check the title.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || rawInput;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumb = video.thumbnail || thumb;
        views = video.views ? Number(video.views).toLocaleString() : views;
      }

      // Step 1: Fetch Direct Video URL
      const vidData = await fetchVideoFromChamindu(videoUrl, selectedQuality);
      const cleanTitle = (vidData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      // Step 2: Buffer Download
      const videoRes = await axios.get(vidData.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 90000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const videoBuffer = Buffer.from(videoRes.data);

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      const videoCard = `╭──────❮ 🎬 *HESHAN-MD VIDEO* ❯──────╮
│
├ 🏷️ *Title    :* ${cleanTitle.slice(0, 36)}
├ 👤 *Channel  :* ${author}
├ ⏱️ *Duration :* ${duration}
├ 👁️ *Views    :* ${views}
├ ⚡ *Quality  :* ${vidData.quality}
├ 🚀 *Engine   :* SaveTube 10Gbps CDN
│
╰────────────────────────────────────╯${DEFAULT_FOOTER}`.trim();

      // Step 3: Send Video Details Card
      try {
        await sock.sendMessage(targetChat, {
          image: { url: vidData.thumbnail || thumb },
          caption: videoCard,
          contextInfo: channelContext
        }, { quoted: msg });
      } catch (e) {}

      // Step 4: Video එක ලොකු නම් Document එකක් විදියට, නැත්නම් Direct Video එකක් විදියට Send කිරීම
      const isTooLargeForNormalVideo = videoBuffer.length > 90 * 1024 * 1024; // > 90MB

      if (isTooLargeForNormalVideo) {
        await sock.sendMessage(targetChat, {
          document: videoBuffer,
          mimetype: 'video/mp4',
          fileName: `${cleanTitle}.mp4`,
          caption: `🎥 *${cleanTitle}* [${vidData.quality}]`
        }, { quoted: msg });
      } else {
        await sock.sendMessage(targetChat, {
          video: videoBuffer,
          mimetype: 'video/mp4',
          fileName: `${cleanTitle}.mp4`,
          caption: `🎥 *${cleanTitle}* [${vidData.quality}]`
        }, { quoted: msg });
      }

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Video Download Error:', err.message);

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
