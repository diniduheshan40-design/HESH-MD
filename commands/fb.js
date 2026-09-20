// commands/fb.js
const axios = require('axios');

// ⚡ Facebook Video Data Extractor (Thinuzz API Integration)
async function fetchFbVideo(facebookUrl) {
  const apiKey = 'key_525b5ceb068ac7f2';
  const apiUrl = `https://mr-thinuzz-api-build.vercel.app/api/fbdown/download?url=${encodeURIComponent(facebookUrl)}&apiKey=${apiKey}`;

  // 1. Primary: Mr Thinuzz FB API
  try {
    const res = await axios.get(apiUrl, {
      timeout: 25000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const data = res.data?.data;
    const downloadUrl = data?.links?.hd || data?.links?.sd;

    if (downloadUrl && typeof downloadUrl === 'string' && downloadUrl.startsWith('http')) {
      return {
        videoUrl: downloadUrl,
        title: data?.title || 'Facebook Video',
        duration: data?.duration || 'N/A',
        quality: data?.quality_found || (data?.links?.hd ? 'HD' : 'SD'),
        thumbnail: data?.thumbnail
      };
    }
  } catch (e) {
    console.error('Thinuzz FB API Error:', e.message);
  }

  // 2. High-Speed Fallback 1: Siputzx
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(facebookUrl)}`, { timeout: 12000 });
    const dl = res.data?.data?.urls?.[0]?.hd || res.data?.data?.urls?.[0]?.sd || res.data?.data?.download_url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return { videoUrl: dl, title: res.data?.data?.title || 'Facebook Video', quality: 'HD' };
    }
  } catch (e) {}

  // 3. High-Speed Fallback 2: Ryzendesu
  try {
    const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/fbdl?url=${encodeURIComponent(facebookUrl)}`, { timeout: 12000 });
    const dl = res.data?.hd || res.data?.sd || res.data?.url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return { videoUrl: dl, title: res.data?.title || 'Facebook Video', quality: 'HD' };
    }
  } catch (e) {}

  throw new Error('වීඩියෝව ලබා ගැනීමට නොහැකි විය. Link එක නිවැරදිදැයි බලන්න.');
}

// ⚡ Buffer Downloader (Network drop වීම් වැළැක්වීමට)
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
  alias: ['facebook', 'fbdl'],
  category: 'download',
  desc: 'Download Facebook Videos Error-Free',

  async execute(sock, msg, args, chatJid) {
    const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';

    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    const rawUrl = (Array.isArray(args) ? args[0] : String(args || '')).trim();

    if (!rawUrl || (!rawUrl.includes('facebook.com') && !rawUrl.includes('fb.watch') && !rawUrl.includes('fb.gg') && !rawUrl.includes('fb.me'))) {
      return await sock.sendMessage(targetChat, { 
        text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර නිවැරදි Facebook වීඩියෝ link එකක් ඇතුළත් කරන්න!*\n\n📘 *උදාහරණ:*\n• .fb https://www.facebook.com/share/v/xxxx/${DEFAULT_FOOTER}`,
        contextInfo: global.channelContext?.contextInfo || {}
      }, { quoted: msg });
    }

    sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    // Waiting Message එක
    let loadMsg = await sock.sendMessage(targetChat, { 
      text: `⏳ *පොඩ්ඩක් ඉන්න සුදු මැණික...*\nFacebook වීඩියෝව බාගත කරමින් පවතී... 🎥${DEFAULT_FOOTER}` 
    }, { quoted: msg }).catch(() => null);

    try {
      // 1. Video Data ලබා ගැනීම
      const fbData = await fetchFbVideo(rawUrl);

      // 2. Video File එක Buffer එකක් ලෙස download කිරීම
      const videoBuffer = await downloadVideoBuffer(fbData.videoUrl);

      if (videoBuffer.length < 10000) {
        throw new Error('ලබාගත් වීඩියෝව දෝෂ සහිතයි (Corrupted File).');
      }

      // 3. Waiting Message එක Delete කිරීම
      if (loadMsg?.key) {
        await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
      }

      const caption = `╭──────❮ 📘 *HESHAN-MD FB DL* ❯──────╮
│
├ 🏷️ *Title    :* ${fbData.title.slice(0, 36)}
├ ⏱️ *Duration :* ${fbData.duration}
├ ⚡ *Quality  :* ${fbData.quality}
│
╰────────────────────────────────────╯${DEFAULT_FOOTER}`.trim();

      // 4. Video Dispatch
      await sock.sendMessage(targetChat, {
        video: videoBuffer,
        caption: caption,
        mimetype: 'video/mp4',
        fileName: 'fb_video.mp4',
        contextInfo: global.channelContext?.contextInfo || {}
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('FB Download Error:', err.message);

      if (loadMsg?.key) {
        sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, { 
        text: `❌ *Facebook Download Error:* ${err.message}${DEFAULT_FOOTER}`,
        contextInfo: global.channelContext?.contextInfo || {}
      }, { quoted: msg }).catch(() => {});
    }
  }
};

