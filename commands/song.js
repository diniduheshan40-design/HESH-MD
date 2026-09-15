const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

module.exports = {
  name: 'song',
  category: 'download',
  desc: 'Download YouTube song in MP3',
  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key.remoteJid;
    const query = args.join(' ').trim();

    if (!query) {
      return await sock.sendMessage(targetChat, { 
        text: "❗ *Please provide a song name or link!*\n*Example:* `.song Faded`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
      }, { quoted: msg });
    }

    let statusMsg = null;

    try {
      // 1. Instant 🎵 Reaction
      await sock.sendMessage(targetChat, { react: { text: "🎵", key: msg.key } }).catch(() => {});

      // 2. Short English Alert (පසුව delete වේ)
      statusMsg = await sock.sendMessage(targetChat, {
        text: "⚡ *Downloading your song, please wait...*"
      }, { quoted: msg });

      let videoUrl = query;
      let videoTitle = query;
      let duration = 'N/A';
      let author = 'YouTube Music';
      let thumbnail = 'https://files.catbox.moe/a58add.jpeg';
      let views = 'N/A';

      // 3. Search Engine
      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      if (!isYtUrl) {
        if (!yts) {
          if (statusMsg) await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
          return await sock.sendMessage(targetChat, { text: "❌ yt-search module not found." }, { quoted: msg });
        }
        
        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          if (statusMsg) await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
          await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(targetChat, { text: "❌ Song not found! Please check the title." }, { quoted: msg });
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title;
        duration = video.timestamp || 'N/A';
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : 'N/A';
      }

      // 4. Fetch MP3 Direct Link
      let downloadUrl = null;
      let finalTitle = videoTitle;

      try {
        const chamaRes = await axios.get(`https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=128kbps&api_key=chama_api_b764539713b0514de0dbb60f401cd69e`, { timeout: 15000 });
        downloadUrl = chamaRes.data?.data?.download_url || chamaRes.data?.data?.direct_url;
        if (chamaRes.data?.data?.title) finalTitle = chamaRes.data.data.title;
      } catch (e1) {
        console.warn('Primary Chamindu API failed, trying backup...');
      }

      if (!downloadUrl) {
        try {
          const backupRes = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
          downloadUrl = backupRes.data?.result?.download_url;
          if (backupRes.data?.result?.title) finalTitle = backupRes.data.result.title;
        } catch (e2) {}
      }

      if (!downloadUrl) {
        throw new Error('Failed to retrieve download link.');
      }

      // 5. Delete Alert Message
      if (statusMsg) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // 6. Clean Card Design (Thumbnail Card එක විතරක් Quoted කර යවයි)
      const cleanTitle = finalTitle.replace(/[\\/:"*?<>|]/g, '').trim();
      const songCard = `╭───❮ 🎵 *H E S H A N - M D* ❯───╮
│
│ 📌 *Title:* ${cleanTitle.slice(0, 38)}
│ 👤 *Artist:* ${author}
│ ⏱️ *Duration:* ${duration}
│ 👁️ *Views:* ${views}
│ 🚀 *Engine:* High-Speed Audio
│
╰───────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      await sock.sendMessage(targetChat, {
        image: { url: thumbnail },
        caption: songCard
      }, { quoted: msg });

      // 7. Send Pure Audio (කිසිම Quoted Box එකක් හෝ Link එකක් නොමැතිව තනි Audio එකක් පමණක් යවයි)
      await sock.sendMessage(targetChat, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`
      });

      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song Error:', err.message);
      if (statusMsg) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { text: `❌ Error: ${err.message}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡` }, { quoted: msg });
    }
  }
};

