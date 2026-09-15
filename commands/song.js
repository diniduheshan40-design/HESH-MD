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
        text: "❗ *කරුණාකර සිංදුවේ නම හෝ Link එකක් ලබාදෙන්න!*\n*උදාහරණ:* `.song Faded`\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } });

      let videoUrl = query;
      let videoTitle = query;
      let duration = 'N/A';
      let author = 'YouTube Music';
      let thumbnail = 'https://files.catbox.moe/a58add.jpeg';
      let views = 'N/A';

      // 1. YouTube Search
      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      if (!isYtUrl) {
        if (!yts) {
          return await sock.sendMessage(targetChat, { text: "❌ yt-search module එක සොයාගත නොහැකි විය." }, { quoted: msg });
        }
        
        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } });
          return await sock.sendMessage(targetChat, { text: "❌ සිංදුව හමු නොවීය! නම නිවැරදිදැයි බලන්න." }, { quoted: msg });
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title;
        duration = video.timestamp || 'N/A';
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : 'N/A';
      }

      // 2. Fetch MP3 Download Link (ඔබේ Chamindu API එක Primary ලෙස)
      let downloadUrl = null;
      let finalTitle = videoTitle;

      try {
        const chamaRes = await axios.get(`https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=128kbps&api_key=chama_api_b764539713b0514de0dbb60f401cd69e`, { timeout: 15000 });
        downloadUrl = chamaRes.data?.data?.download_url || chamaRes.data?.data?.direct_url;
        if (chamaRes.data?.data?.title) finalTitle = chamaRes.data.data.title;
      } catch (e1) {
        console.warn('Primary Chamindu API failed, trying backup...');
      }

      // Fast Backup API
      if (!downloadUrl) {
        try {
          const backupRes = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
          downloadUrl = backupRes.data?.result?.download_url;
          if (backupRes.data?.result?.title) finalTitle = backupRes.data.result.title;
        } catch (e2) {}
      }

      if (!downloadUrl) {
        throw new Error('බාගත කිරීමේ සබැඳිය ලබා ගැනීමට නොහැකි විය.');
      }

      // 3. Information Card (ක්ෂණිකව යැවීම)
      const songCard = `╭───❮ 🎵 *H E S H A N - M D* ❯───╮
│
│ 📌 *Title:* ${finalTitle.slice(0, 40)}
│ 👤 *Artist:* ${author}
│ ⏱️ *Duration:* ${duration}
│ 👁️ *Views:* ${views}
│ 🔗 *Source:* YouTube Engine
│
╰───────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      await sock.sendMessage(targetChat, {
        image: { url: thumbnail },
        caption: songCard
      }, { quoted: msg });

      // 4. Send Audio directly via URL (RAM Buffer එකක් නැති නිසා 100% smooth & fast)
      await sock.sendMessage(targetChat, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${finalTitle.replace(/[\\/:"*?<>|]/g, '')}.mp3`,
        contextInfo: {
          externalAdReply: {
            title: finalTitle.slice(0, 32),
            body: `${author} • ${duration}`,
            thumbnailUrl: thumbnail,
            sourceUrl: videoUrl,
            mediaType: 2,
            renderLargerThumbnail: true
          }
        }
      }, { quoted: msg });

      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } });

    } catch (err) {
      console.error('Song Error:', err.message);
      try { await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }); } catch (e) {}
      await sock.sendMessage(targetChat, { text: `❌ දෝෂයක්: ${err.message}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡` }, { quoted: msg });
    }
  }
};

