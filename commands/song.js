// commands/song.js
let yts = null;
try {
  yts = require('yt-search');
} catch (e) {}

global.songSessions = global.songSessions || new Map();

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3', 'ytmp3'],
  category: 'download',
  desc: 'Fast Compact YouTube Downloader',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    const channelContext = global.channelContext?.contextInfo || {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363421906774107@newsletter',
        newsletterName: '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨',
        serverMessageId: 1
      }
    };

    let rawInput = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    if (!rawInput) {
      await sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(targetChat, { 
        text: `*🎧 HESHAN MUSIC*\n\n> 💡 ගීතයේ නම ඇතුළත් කරන්න.\n> 📌 උදා: *.song Lelena*`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    // 1. Search වෙද්දී 🔎 Reaction එක වැටේ
    await sock.sendMessage(targetChat, { react: { text: "🔎", key: msg.key } }).catch(() => {});

    try {
      let videoUrl = rawInput;
      let videoTitle = rawInput;
      let duration = '03:20';
      let thumb = 'https://files.catbox.moe/a58add.jpeg';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(rawInput);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search missing.');
        const searchResults = await yts(rawInput);
        if (!searchResults?.videos?.length) {
          throw new Error('Song not found on YouTube!');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || rawInput;
        duration = video.timestamp || duration;
        thumb = video.thumbnail || thumb;
      }

      let cleanTitle = videoTitle.replace(/[\\/:"*?<>|]/g, '').trim();
      if (cleanTitle.length > 20) cleanTitle = cleanTitle.slice(0, 18) + '..';

      // 📱 Ultra-Compact Single Glance Box (Screen එකෙන් 25%ක් පමණි)
      const miniCard = 
`╭───❮ 🎧 *HESHAN* ❯───╮
│ 🎵 *${cleanTitle}* [${duration}]
├── Reply Number: ────┤
│ *[1]* Audio (MP3)
│ *[2]* Document (HQ)
│ *[3]* Voice (PTT)
╰─────────────────────╯`.trim();

      const sentMsg = await sock.sendMessage(targetChat, {
        image: { url: thumb },
        caption: miniCard,
        contextInfo: channelContext
      }, { quoted: msg });

      // 2. Card එක වැටුණු සැනින් User message එකට 🎵 වැටේ
      await sock.sendMessage(targetChat, { react: { text: "🎵", key: msg.key } }).catch(() => {});

      if (sentMsg?.key?.id) {
        global.songSessions.set(sentMsg.key.id, {
          videoUrl,
          title: cleanTitle,
          duration,
          sender: msg.key.participant || targetChat,
          time: Date.now()
        });

        setTimeout(() => {
          global.songSessions.delete(sentMsg.key.id);
        }, 5 * 60 * 1000);
      }

    } catch (err) {
      console.error('Song Search Error:', err?.message || err);
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *Error:* ${err.message || 'Unable to find song.'}`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};
