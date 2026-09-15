// commands/tiktok.js
const axios = require('axios');

module.exports = {
  name: 'tiktok',
  alias: ['tt'],
  category: 'download',
  desc: 'Download TikTok video without watermark',
  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : msg.key.remoteJid;

    const url = args[0]?.trim();

    if (!url || (!url.includes('tiktok.com') && !url.includes('tiktok.com/'))) {
      const helpText = `┏━━━❮ ⚠️ *TIKTOK DOWNLOADER* ❯━━━┓
┃
┃ ◈ *Usage*   : \`.tiktok <link>\` or \`.tt <link>\`
┃ ◈ *Example* : \`.tt https://vt.tiktok.com/xxxx/\`
┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;
      return await sock.sendMessage(targetChat, { text: helpText }, { quoted: msg });
    }

    const API_BASE = "https://api.chamindu.site";
    const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
    let statusMsg = null;

    try {
      // 1. React & Instant Short Alert
      await sock.sendMessage(targetChat, { react: { text: '🎵', key: msg.key } }).catch(() => {});

      statusMsg = await sock.sendMessage(targetChat, {
        text: "⚡ *Downloading TikTok video, please wait...*"
      }, { quoted: msg });

      let videoUrl = null;
      let title = 'TikTok Video';
      let author = 'Creator';

      // 2. Primary Engine (Chamindu API)
      try {
        const res = await axios.get(`${API_BASE}/api/v1/download/tiktok?url=${encodeURIComponent(url)}&api_key=${API_KEY}`, { timeout: 15000 });
        const data = res.data?.data;
        if (data?.downloads) {
          videoUrl = data.downloads.no_watermark_hd || data.downloads.no_watermark;
          title = data.title || title;
          author = data.author || author;
        }
      } catch (apiErr) {
        console.warn('Chamindu API failed, switching to backup engine...');
      }

      // 3. Fallback Engine (TikWM)
      if (!videoUrl) {
        try {
          const resFallback = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, { timeout: 15000 });
          const fData = resFallback.data?.data;
          if (fData) {
            videoUrl = fData.play || fData.hdplay || fData.wmplay;
            title = fData.title || title;
            author = fData.author?.nickname || fData.author?.unique_id || author;
          }
        } catch (e) {}
      }

      // Delete status message before sending final media
      if (statusMsg) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      if (!videoUrl) {
        await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
        return await sock.sendMessage(targetChat, { 
          text: `❌ *Could not fetch video. Please check the URL!* \n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡` 
        }, { quoted: msg });
      }

      // 4. Compact Cyber Box Caption
      const cleanTitle = title.replace(/[\\/:"*?<>|]/g, '').trim();
      const caption = `┏━━━❮ 🎬 *TIKTOK HD* ❯━━━┓
┃
┃ 📌 *Title*  : ${cleanTitle.slice(0, 36)}
┃ 👤 *Author* : ${author}
┃ 🚀 *Engine* : Fast No-Watermark
┃
┗━━━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

      // 5. Send Video Directly via URL
      await sock.sendMessage(targetChat, {
        video: { url: videoUrl },
        caption: caption,
        mimetype: 'video/mp4'
      }, { quoted: msg });

      await sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('TikTok DL Error:', err.message);
      if (statusMsg) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *TikTok Download Error:* ${err.message}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡` 
      }, { quoted: msg });
    }
  }
};
