// commands/pt.js
const axios = require('axios');

// Resolve pin.it short links
async function resolvePinterestUrl(shortUrl) {
  try {
    const res = await axios.get(shortUrl, {
      maxRedirects: 5,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    return res.request?.res?.responseUrl || shortUrl;
  } catch (e) {
    return shortUrl;
  }
}

// Media Stream Buffer Helper
async function fetchMediaBuffer(url) {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return Buffer.from(res.data);
  } catch (e) {
    return null;
  }
}

module.exports = {
  name: 'pt',
  alias: ['pinterest', 'pindl', 'pin'],
  category: 'download',
  desc: 'Download Pinterest Media (Video & Image)',

  async execute(sock, msg, args, chatJid, safeReply) {
    const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
    };

    const rawUrl = (Array.isArray(args) ? args[0] : String(args || '')).trim();

    if (!rawUrl || (!rawUrl.includes('pinterest.com') && !rawUrl.includes('pin.it'))) {
      return await reply(
        `*❪ PINTEREST DOWNLOADER ❫*\n\n⚠️ *කරුණාකර Pinterest link එකක් ලබාදෙන්න!*\n\n📌 *Example:*\n• .pt https://pin.it/xxxxxx\n• .pt https://www.pinterest.com/pin/xxxxxx/${DEFAULT_FOOTER}`
      );
    }

    sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    const cleanUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    const resolvedUrl = cleanUrl.includes('pin.it') ? await resolvePinterestUrl(cleanUrl) : cleanUrl;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    try {
      let mediaType = null;
      let mediaUrl = null;
      let title = 'Pinterest Media';

      // ⚡ Multi-API Fast Extraction Pool
      const extractors = [
        // 1. Chamindu API
        async () => {
          const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
          const apiUrl = `https://api.chamindu.site/api/v1/media/pinterest/infodl?q=${encodeURIComponent(resolvedUrl)}&api_key=${API_KEY}`;
          const res = await axios.get(apiUrl, { timeout: 10000, headers });
          const data = res.data?.data;
          if (!data) return null;

          if (data.title) title = data.title;
          const downloads = Array.isArray(data.downloads) ? data.downloads : [];

          const vid = downloads.find(d => d.type === 'video' || (d.link && d.link.includes('.mp4')));
          if (vid?.link) return { type: 'video', url: vid.link };

          const img = downloads.find(d => d.type === 'image' || d.type === 'image_direct') || (data.image ? { link: data.image } : null);
          if (img?.link) return { type: 'image', url: img.link };
          return null;
        },
        // 2. GiftedTech Pinterest Gateway
        async () => {
          const res = await axios.get(`https://api.giftedtech.web.id/api/download/pinterestdl?apikey=gifted&url=${encodeURIComponent(resolvedUrl)}`, { timeout: 10000, headers });
          const result = res.data?.result;
          if (result?.media) {
            const isVid = result.media.includes('.mp4');
            return { type: isVid ? 'video' : 'image', url: result.media };
          }
          return null;
        },
        // 3. BK9 Pinterest Downloader
        async () => {
          const res = await axios.get(`https://bk9.fun/download/pinterest?url=${encodeURIComponent(resolvedUrl)}`, { timeout: 10000 });
          const bk = res.data?.BK9;
          if (bk?.media) {
            const isVid = bk.media.includes('.mp4');
            return { type: isVid ? 'video' : 'image', url: bk.media };
          }
          return null;
        }
      ];

      for (const extractor of extractors) {
        try {
          const res = await extractor();
          if (res?.url) {
            mediaType = res.type;
            mediaUrl = res.url;
            break;
          }
        } catch (e) {}
      }

      if (!mediaUrl) {
        sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await reply(`❌ *Pinterest media ලබා ගැනීමට නොහැකි විය. Link එක නිවැරදි දැයි පරීක්ෂා කරන්න!*${DEFAULT_FOOTER}`);
      }

      const caption = `*📌 𝗣𝗜𝗡𝗧𝗘𝗥𝗘𝗦𝗧 ${mediaType.toUpperCase()} 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📌*\n\n📝 *Title:* ${title}${DEFAULT_FOOTER}`;

      sock.sendMessage(targetChat, { react: { text: '⬆️', key: msg.key } }).catch(() => {});

      if (mediaType === 'video') {
        try {
          await sock.sendMessage(targetChat, {
            video: { url: mediaUrl },
            caption: caption,
            mimetype: 'video/mp4',
            ...(global.channelContext || {})
          }, { quoted: msg });
        } catch (err) {
          const buf = await fetchMediaBuffer(mediaUrl);
          if (!buf) throw err;
          await sock.sendMessage(targetChat, {
            video: buf,
            caption: caption,
            mimetype: 'video/mp4',
            ...(global.channelContext || {})
          }, { quoted: msg });
        }
      } else {
        try {
          await sock.sendMessage(targetChat, {
            image: { url: mediaUrl },
            caption: caption,
            ...(global.channelContext || {})
          }, { quoted: msg });
        } catch (err) {
          const buf = await fetchMediaBuffer(mediaUrl);
          if (!buf) throw err;
          await sock.sendMessage(targetChat, {
            image: buf,
            caption: caption,
            ...(global.channelContext || {})
          }, { quoted: msg });
        }
      }

      sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Pinterest DL Error:', err?.message || err);
      sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
      await reply(`❌ *Pinterest Download Error:* ${err.message || 'Server error'}${DEFAULT_FOOTER}`);
    }
  }
};
