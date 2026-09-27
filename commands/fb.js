// commands/fb.js
const axios = require('axios');

// ⚡ Multi-Engine Facebook Video Extractor
async function fetchFbVideo(facebookUrl) {
  const targetUrl = encodeURIComponent(facebookUrl);

  // 1. Primary: GiftedTech FB API
  try {
    const res = await axios.get(`https://api.giftedtech.web.id/api/download/facebook?apikey=gifted&url=${targetUrl}`, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const result = res.data?.result;
    const downloadUrl = result?.hd_video || result?.sd_video || result?.video;

    if (downloadUrl && typeof downloadUrl === 'string' && downloadUrl.startsWith('http')) {
      return {
        videoUrl: downloadUrl,
        title: result?.title || 'Facebook Video',
        duration: result?.duration || 'N/A',
        quality: result?.hd_video ? 'HD' : 'SD'
      };
    }
  } catch (e) {}

  // 2. Fallback 1: BK9 FB Gateway
  try {
    const res = await axios.get(`https://bk9.fun/download/fb?url=${targetUrl}`, {
      timeout: 15000
    });

    const bkData = res.data?.BK9;
    const dl = bkData?.hd || bkData?.sd || bkData?.video;

    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return {
        videoUrl: dl,
        title: bkData?.title || 'Facebook Video',
        duration: 'N/A',
        quality: bkData?.hd ? 'HD' : 'SD'
      };
    }
  } catch (e) {}

  // 3. Fallback 2: Thinuzz API
  try {
    const apiKey = 'key_525b5ceb068ac7f2';
    const apiUrl = `https://mr-thinuzz-api-build.vercel.app/api/fbdown/download?url=${targetUrl}&apiKey=${apiKey}`;

    const res = await axios.get(apiUrl, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const data = res.data?.data;
    const downloadUrl = data?.links?.hd || data?.links?.sd;

    if (downloadUrl && typeof downloadUrl === 'string' && downloadUrl.startsWith('http')) {
      return {
        videoUrl: downloadUrl,
        title: data?.title || 'Facebook Video',
        duration: data?.duration || 'N/A',
        quality: data?.quality_found || (data?.links?.hd ? 'HD' : 'SD')
      };
    }
  } catch (e) {}

  throw new Error('Unable to fetch video. Make sure the video is public and link is valid.');
}

// ⚡ Memory-Safe Video Fetcher
async function downloadVideoBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  return Buffer.from(response.data);
}

module.exports = {
  name: 'fb',
  alias: ['facebook', 'fbdl', 'fbreel'],
  category: 'download',
  desc: 'Download Facebook Videos & Reels Error-Free',

  async execute(sock, msg, args, chatJid, safeReply) {
    const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';

    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
    };

    const rawUrl = (Array.isArray(args) ? args[0] : String(args || '')).trim();

    const isFbUrl = /(?:facebook\.com|fb\.watch|fb\.gg|fb\.me)\//i.test(rawUrl);

    if (!rawUrl || !isFbUrl) {
      return await reply(
        `*❪ FACEBOOK DOWNLOADER ❫*\n\n⚠️ *Please provide a valid Facebook video or reel link!*\n\n📘 *Example:*\n• .fb https://www.facebook.com/share/v/xxxx/${DEFAULT_FOOTER}`
      );
    }

    sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    let loadMsg = await sock.sendMessage(targetChat, { 
      text: `⚡ *Processing Facebook Media...*\nPlease wait a moment while we fetch your video. 🎥${DEFAULT_FOOTER}`,
      ...(global.channelContext || {})
    }, { quoted: msg }).catch(() => null);

    try {
      // 1. Data Extract
      const fbData = await fetchFbVideo(rawUrl);

      // 2. Safe Buffer Download
      const videoBuffer = await downloadVideoBuffer(fbData.videoUrl);

      if (!videoBuffer || videoBuffer.length < 5000) {
        throw new Error('Downloaded file is invalid or empty.');
      }

      if (loadMsg?.key) {
        await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
      }

      const caption = 
`╭──────❮ 📘 *HESHAN-MD FB DL* ❯──────╮
│
├ 🏷️ *Title    :* ${fbData.title.slice(0, 36)}
├ ⏱️ *Duration :* ${fbData.duration}
├ ⚡ *Quality  :* ${fbData.quality}
│
╰────────────────────────────────────╯${DEFAULT_FOOTER}`.trim();

      await sock.sendMessage(targetChat, { react: { text: '⬆️', key: msg.key } }).catch(() => {});

      // 3. Dispatch Video
      await sock.sendMessage(targetChat, {
        video: videoBuffer,
        caption: caption,
        mimetype: 'video/mp4',
        fileName: 'fb_video.mp4',
        ...(global.channelContext || {})
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('FB Download Error:', err?.message || err);

      if (loadMsg?.key) {
        await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});

      await reply(`❌ *Facebook Download Error:* ${err.message || 'Server busy'}${DEFAULT_FOOTER}`);
    }
  }
};
