// commands/img.js
const axios = require('axios');

// ⚡ Multi-Engine Image Fetcher
async function fetchGoogleImages(query) {
  const cleanQ = encodeURIComponent(query);

  // 1. Engine 1: SupunOFC API
  try {
    const apiKey = 'supun-tvo5olfxylo98b8l6b9lq174';
    const res = await axios.get(`https://supunofc.site/api/search/google-image-search/search?q=${cleanQ}&apikey=${apiKey}`, { timeout: 8000 });
    if (res.data?.success && Array.isArray(res.data?.result) && res.data.result.length > 0) {
      const urls = res.data.result
        .map(item => (typeof item === 'string' ? item : item?.url || item?.image))
        .filter(url => typeof url === 'string' && url.startsWith('http'));
      if (urls.length > 0) return urls.slice(0, 3);
    }
  } catch (e) {}

  // 2. Engine 2: BK9 Google Image Search
  try {
    const res = await axios.get(`https://bk9.fun/search/gimage?q=${cleanQ}`, { timeout: 8000 });
    if (res.data?.status && Array.isArray(res.data?.BK9) && res.data.BK9.length > 0) {
      const urls = res.data.BK9
        .map(item => (typeof item === 'string' ? item : item?.url || item?.image))
        .filter(url => typeof url === 'string' && url.startsWith('http'));
      if (urls.length > 0) return urls.slice(0, 3);
    }
  } catch (e) {}

  // 3. Engine 3: Siputzx Pinterest/Google fallback
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${cleanQ}`, { timeout: 8000 });
    if (res.data?.status && Array.isArray(res.data?.data) && res.data.data.length > 0) {
      const urls = res.data.data
        .map(item => (typeof item === 'string' ? item : item?.images_url || item?.url))
        .filter(url => typeof url === 'string' && url.startsWith('http'));
      if (urls.length > 0) return urls.slice(0, 3);
    }
  } catch (e) {}

  throw new Error('Images not found');
}

// Helper to fetch image buffer to bypass hotlink protection
async function fetchImageBuffer(url) {
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    return Buffer.from(res.data);
  } catch (e) {
    return null;
  }
}

module.exports = {
  name: 'img',
  alias: ['image', 'gimage'],
  category: 'download',
  desc: 'Search and download Google images',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
    };

    const rawText = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || 
                    msg.message?.imageMessage?.caption || "";

    let query = args && args.length > 0 ? args.join(' ') : "";
    if (!query && rawText) {
      const parts = rawText.trim().split(/\s+/);
      if (parts.length > 1) query = parts.slice(1).join(' ');
    }

    if (!query) {
      return await reply('⚠️ කරුණාකර සෙවිය යුතු පින්තූරයේ නම ඇතුළත් කරන්න!\n\nඋදාහරණ: *.img cute cat*');
    }

    sock.sendMessage(targetChat, { react: { text: "🔍", key: msg.key } }).catch(() => {});

    try {
      const validImages = await fetchGoogleImages(query);

      if (!validImages || validImages.length === 0) {
        sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await reply(`❌ *${query}* සඳහා කිසිදු පින්තූරයක් හමු නොවීය.`);
      }

      sock.sendMessage(targetChat, { react: { text: "📸", key: msg.key } }).catch(() => {});

      for (let i = 0; i < validImages.length; i++) {
        const imageUrl = validImages[i];
        const caption = `┏━━━〔 🖼️ 𝐆𝐎𝐎𝐆𝐋𝐄 𝐈𝐌𝐀𝐆𝐄 〕━━━┓\n` +
                        `┃\n` +
                        `┃  🔍 *Query* ⌁ ${query}\n` +
                        `┃  📸 *Image* ⌁ ${i + 1}/${validImages.length}\n` +
                        `┃\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                        `> 🔐 *heshan ofc • all rights reserved*`;

        const imgBuffer = await fetchImageBuffer(imageUrl);
        const imagePayload = imgBuffer ? { image: imgBuffer } : { image: { url: imageUrl } };

        await sock.sendMessage(targetChat, {
          ...imagePayload,
          caption: caption,
          ...(global.channelContext || {})
        }, { quoted: msg }).catch(() => {});
      }

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("Image Command Error:", err?.message || err);
      sock.sendMessage(targetChat, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
      await reply('⚠️ පින්තූර ලබා ගැනීමේදී දෝෂයක් ඇති විය. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.');
    }
  }
};
