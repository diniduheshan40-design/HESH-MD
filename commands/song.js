// commands/song.js
const axios = require('axios');

let yts = null;
try {
  yts = require('yt-search');
} catch (e) {}

const CHAMINDU_API_KEY = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';
global.songSessions = global.songSessions || new Map();

function extractYouTubeId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = String(url).match(regExp);
  return match ? match[1] : null;
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3', 'ytmp3'],
  category: 'download',
  desc: 'Compact YouTube Music Downloader',

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
        text: `*🎧 HESHAN MUSIC*\n\n> 💡 Please enter song name.\n> 📌 Example: *.song Lelena*`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    await sock.sendMessage(targetChat, { react: { text: "⬆️", key: msg.key } }).catch(() => {});

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

      // අකුරු ගාන Phone Screen එකට ගැලපෙන සේ සීමා කිරීම (Read more වැළැක්වීමට)
      let cleanTitle = videoTitle.replace(/[\\/:"*?<>|]/g, '').trim();
      if (cleanTitle.length > 22) cleanTitle = cleanTitle.slice(0, 19) + '...';

      // 📱 Compact Ultra-Clean Mini Player (No "Read more")
      const miniCard = 
`┌─❮ 🎧 *HESHAN PLAYER* ❯─┐
│
├ 🎵 *Song :* ${cleanTitle}
├ ⏱️ *Time :* ${duration}
│
├ 🔘───── ❚❚ ───── ${duration}
│
├ 📥 *Reply with format:*
│  *[1]* Audio (MP3)
│  *[2]* Document (File)
│  *[3]* Voice Note (PTT)
│
└────────────────────────┘`.trim();

      const sentMsg = await sock.sendMessage(targetChat, {
        image: { url: thumb },
        caption: miniCard,
        contextInfo: channelContext
      }, { quoted: msg });

      if (sentMsg?.key?.id) {
        global.songSessions.set(sentMsg.key.id, {
          videoUrl,
          title: cleanTitle,
          duration,
          thumb,
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
