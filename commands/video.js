const axios = require('axios');
const yts = require('yt-search');

module.exports = {
  name: 'video',
  category: 'download',
  desc: 'Download YouTube video in MP4',
  async execute(sock, msg, args, chatJid, safeReply) {
    const query = args.join(' ').trim();
    if (!query) {
      return await sock.sendMessage(chatJid, { 
        text: '⚠️ *වීඩියෝවේ නම හෝ YouTube link එක ලබා දෙන්න!*\n\n> උදා: `.video Neth Manema`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(chatJid, { react: { text: '🎬', key: msg.key } });

      let videoUrl = query;
      let videoTitle = query;
      let duration = 'N/A';
      let thumbnail = '';

      // 1. Check if user sent a query or a direct link
      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      if (!isYtUrl) {
        const search = await yts(query);
        const video = search.videos && search.videos[0];
        if (!video) {
          return await sock.sendMessage(chatJid, { 
            text: '❌ වීඩියෝවක් සොයා ගැනීමට නොහැකි විය. කරුණාකර නම නිවැරදිව ලබා දෙන්න.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
          }, { quoted: msg });
        }
        videoUrl = video.url;
        videoTitle = video.title;
        duration = video.timestamp || 'N/A';
        thumbnail = video.thumbnail;
      }

      // 2. Fetch direct MP4 URL using fast APIs with fallback
      let downloadUrl = null;

      // Primary API
      try {
        const res1 = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(videoUrl)}`, { timeout: 25000 });
        if (res1.data?.result?.download_url) {
          downloadUrl = res1.data.result.download_url;
          if (!videoTitle || videoTitle === query) videoTitle = res1.data.result.title;
          if (res1.data.result.duration) duration = res1.data.result.duration;
        }
      } catch (e1) {}

      // Fallback API if primary fails
      if (!downloadUrl) {
        try {
          const res2 = await axios.get(`https://api.giftedtech.my.id/api/download/ytmp4?url=${encodeURIComponent(videoUrl)}&apikey=gifted`, { timeout: 25000 });
          if (res2.data?.result?.download_url) {
            downloadUrl = res2.data.result.download_url;
          }
        } catch (e2) {}
      }

      if (!downloadUrl) {
        return await sock.sendMessage(chatJid, { 
          text: '❌ වීඩියෝව බාගත කිරීමේ Link එක ලබා ගැනීමට නොහැකි විය. පසුව නැවත උත්සාහ කරන්න.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
        }, { quoted: msg });
      }

      const captionText = `*🎬 ${videoTitle}*

⏱️ *Duration:* ${duration}
🌐 *Source:* YouTube

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      // 3. Send video directly
      await sock.sendMessage(chatJid, {
        video: { url: downloadUrl },
        caption: captionText,
        mimetype: 'video/mp4'
      }, { quoted: msg });

      await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });

    } catch (err) {
      console.error('Video DL Error:', err.message);
      try {
        await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
      } catch (e) {}
      await sock.sendMessage(chatJid, { 
        text: '❌ වීඩියෝව ඩවුන්ලෝඩ් කිරීමේදී දෝෂයක් ඇති විය.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡' 
      }, { quoted: msg });
    }
  }
};
