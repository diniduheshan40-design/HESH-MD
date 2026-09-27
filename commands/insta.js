// commands/insta.js
const axios = require('axios');

// ⚡ Multi-Engine Instagram Media Extractor
async function fetchInstagramMedia(cleanUrl) {
  const targetUrl = encodeURIComponent(cleanUrl);

  // 1. Engine 1: GiftedTech Instagram Downloader (Primary)
  try {
    const res = await axios.get(`https://api.giftedtech.web.id/api/download/instagram?apikey=gifted&url=${targetUrl}`, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const result = res.data?.result;
    if (Array.isArray(result) && result.length > 0) {
      const mediaList = result.map(item => ({
        url: item.url || item.download_url || item,
        type: (item.type || '').includes('image') || (item.url && item.url.includes('.jpg')) ? 'image' : 'video'
      })).filter(m => typeof m.url === 'string' && m.url.startsWith('http'));

      if (mediaList.length > 0) return mediaList;
    }
  } catch (e) {}

  // 2. Engine 2: BK9 Instagram Gateway
  try {
    const res = await axios.get(`https://bk9.fun/download/instagram?url=${targetUrl}`, {
      timeout: 15000
    });

    const bkData = res.data?.BK9;
    if (Array.isArray(bkData) && bkData.length > 0) {
      const mediaList = bkData.map(item => ({
        url: item.url || item,
        type: item.type === 'image' || (item.url && item.url.includes('.jpg')) ? 'image' : 'video'
      })).filter(m => typeof m.url === 'string' && m.url.startsWith('http'));

      if (mediaList.length > 0) return mediaList;
    }
  } catch (e) {}

  // 3. Engine 3: KCeY Worker Fallback
  try {
    const workerUrl = `https://instadl.kcey.workers.dev/?url=${targetUrl}`;
    const res = await axios.get(workerUrl, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const data = res.data;
    const mediaData = data?.result || data?.data || data?.media;

    if (Array.isArray(mediaData) && mediaData.length > 0) {
      const mediaList = mediaData.map(item => ({
        url: item.url || item.download_url || item,
        type: (item.url && item.url.includes('.jpg')) ? 'image' : 'video'
      })).filter(m => typeof m.url === 'string' && m.url.startsWith('http'));

      if (mediaList.length > 0) return mediaList;
    } else if (data?.url) {
      return [{ url: data.url, type: 'video' }];
    }
  } catch (e) {}

  throw new Error('Instagram මාධ්‍යය ලබාගත නොහැක. Post එක Public එකක් දැයි පරීක්ෂා කරන්න!');
}

// Media Stream Buffer Helper
async function downloadMediaBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 45000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  return Buffer.from(res.data);
}

module.exports = {
  name: 'insta',
  alias: ['ig', 'reels', 'igdl', 'reel'],
  category: 'download',
  desc: 'Download Instagram Reels, Videos, and Photos',

  async execute(sock, msg, args, chatJid, safeReply) {
    const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
    };

    const rawText = msg.message?.conversation || 
                    msg.message?.extendedTextMessage?.text || 
                    (Array.isArray(args) ? args.join(' ') : String(args || ''));

    // URL Extract Matcher
    const match = rawText.match(/https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel|reels|tv|share)\/[A-Za-z0-9_-]+/i);

    if (!match) {
      return await reply(
        `*❪ INSTAGRAM DOWNLOADER ❫*\n\n⚠️ *කරුණාකර Instagram Post, Reel හෝ Video link එකක් ලබාදෙන්න!*\n\n📸 *Example:*\n• .insta https://www.instagram.com/reel/xxxxxx/${DEFAULT_FOOTER}`
      );
    }

    const cleanUrl = match[0];
    sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    try {
      const mediaItems = await fetchInstagramMedia(cleanUrl);
      const caption = `*📸 𝗜𝗡𝗦𝗧𝗔𝗚𝗥𝗔𝗠 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📸*${DEFAULT_FOOTER}`;

      sock.sendMessage(targetChat, { react: { text: '⬆️', key: msg.key } }).catch(() => {});

      // Multiple items හෝ Single item handle කිරීම (Max 3 to prevent spam)
      const itemsToSend = mediaItems.slice(0, 3);

      for (const item of itemsToSend) {
        const isImage = item.type === 'image' || item.url.includes('.jpg') || item.url.includes('.jpeg') || item.url.includes('.webp');
        
        try {
          // Direct URL Dispatch
          if (isImage) {
            await sock.sendMessage(targetChat, {
              image: { url: item.url },
              caption: caption,
              ...(global.channelContext || {})
            }, { quoted: msg });
          } else {
            await sock.sendMessage(targetChat, {
              video: { url: item.url },
              caption: caption,
              mimetype: 'video/mp4',
              ...(global.channelContext || {})
            }, { quoted: msg });
          }
        } catch (streamErr) {
          // Fallback to Buffer Dispatch
          const mediaBuf = await downloadMediaBuffer(item.url);
          if (isImage) {
            await sock.sendMessage(targetChat, {
              image: mediaBuf,
              caption: caption,
              ...(global.channelContext || {})
            }, { quoted: msg });
          } else {
            await sock.sendMessage(targetChat, {
              video: mediaBuf,
              caption: caption,
              mimetype: 'video/mp4',
              ...(global.channelContext || {})
            }, { quoted: msg });
          }
        }
      }

      sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Insta DL Error:', err?.message || err);
      sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
      await reply(`❌ *Instagram Download Error:* ${err.message || 'Error downloading media'}${DEFAULT_FOOTER}`);
    }
  }
};
