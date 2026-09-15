const axios = require('axios');

module.exports = {
  name: 'tiktok',
  alias: ['tt'],
  category: 'download',
  desc: 'Download TikTok video without watermark',
  async execute(sock, msg, args, chatJid, safeReply) {
    const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
    const url = args[0]?.trim();

    if (!url || (!url.includes('tiktok.com') && !url.includes('tiktok.com/'))) {
      const helpText = `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර TikTok වීඩියෝ link එකක් ලබා දෙන්න!*\n\n📥 *Example:*\n• .tiktok https://vm.tiktok.com/xxxx/\n• .tt https://vt.tiktok.com/xxxx/${DEFAULT_FOOTER}`;
      return await (safeReply ? safeReply({ text: helpText }) : sock.sendMessage(chatJid, { text: helpText }, { quoted: msg }));
    }

    // 🟢 ඔබේ API විස්තර
    const API_BASE = "https://api.chamindu.site";
    const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";

    try {
      await sock.sendMessage(chatJid, { react: { text: '⏳', key: msg.key } });

      let videoUrl = null;
      let title = 'TikTok Video';
      let author = 'Creator';

      // 1. Primary Engine: ඔයාගේ Custom Chamindu API එක
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

      // 2. Fallback Engine: ඔයාගේ API එකේ අවුලක් වුණොත් විතරක් run වෙන Backup එක (TikWM)
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

      if (!videoUrl) {
        try { await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } }); } catch (e) {}
        const notFoundText = `❌ *වීඩියෝව ලබා ගැනීමට නොහැකි විය. Link එක නිවැරදිදැයි බලන්න!*${DEFAULT_FOOTER}`;
        return await (safeReply ? safeReply({ text: notFoundText }) : sock.sendMessage(chatJid, { text: notFoundText }, { quoted: msg }));
      }

      const caption = `*🎵 𝗧𝗜𝗞𝗧𝗢𝗞 𝗛𝗗 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 🎵*\n\n📝 *Title:* ${title}\n👤 *Author:* ${author}${DEFAULT_FOOTER}`;

      await sock.sendMessage(chatJid, {
        video: { url: videoUrl },
        caption: caption,
        mimetype: 'video/mp4'
      }, { quoted: msg });

      try { await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } }); } catch (e) {}

    } catch (err) {
      console.error('TikTok DL Error:', err.message);
      try { await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } }); } catch (e) {}
      const errText = `❌ *TikTok Download Error:* ${err.message}${DEFAULT_FOOTER}`;
      return await (safeReply ? safeReply({ text: errText }) : sock.sendMessage(chatJid, { text: errText }, { quoted: msg }));
    }
  }
};
