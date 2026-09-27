// commands/song.js
const axios = require('axios');

let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

const MR_THINUZZ_API_KEY = 'key_525b5ceb068ac7f2';

function extractYouTubeId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = String(url).match(regExp);
  return match ? match[1] : null;
}

// ⚡ 100% Working Multi-Engine Audio Stream Fetcher
async function fetchAudioStream(videoUrl) {
  const cleanId = extractYouTubeId(videoUrl);

  // 🥇 Primary Engine: Mr Thinuzz API
  try {
    const apiUrl = `https://mr-thinuzz-api-build.vercel.app/api/ytmp3/download?url=${encodeURIComponent(videoUrl)}&apiKey=${MR_THINUZZ_API_KEY}`;
    const res = await axios.get(apiUrl, { timeout: 15000 });
    const data = res.data?.data;
    const dlUrl = data?.links?.audio;

    if (dlUrl) {
      return {
        downloadUrl: dlUrl,
        title: data?.title || 'YouTube Audio',
        thumbnail: data?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg'),
        duration: data?.duration !== 'N/A' ? data?.duration : null
      };
    }
  } catch (e) {
    console.log("Mr Thinuzz API failed, switching to backup engine...");
  }

  // 🥈 Backup Engine: Dark Yasiya API
  try {
    const res2 = await axios.get(`https://www.dark-yasiya-api.site/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 12000
    });
    const dlUrl2 = res2.data?.result?.dl_link || res2.data?.result?.download;
    if (dlUrl2) {
      return {
        downloadUrl: dlUrl2,
        title: res2.data?.result?.title || 'YouTube Audio',
        thumbnail: res2.data?.result?.thumb || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg'),
        duration: null
      };
    }
  } catch (e) {}

  throw new Error('බාගත කිරීමේ සබැඳිය ලබාගැනීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.');
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3', 'ytmp3'],
  category: 'download',
  desc: 'Download YouTube audio in high quality',

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
      return await sock.sendMessage(targetChat, { 
        text: `*🎵 HESHAN MUSIC PLAYER*\n\n` +
              `> 💡 සින්දුවේ නම හෝ Link එකක් ලබාදෙන්න.\n` +
              `> 📌 උදා: *.song Lelena*\n\n` +
              `🔗 *Pair Site :* https://heshan.devofc.top\n\n` +
              `> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    await sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Searching Track:* _${rawInput}_...\n📥 සින්දුව සොයමින් පවතී...`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = rawInput;
      let videoTitle = rawInput;
      let duration = '03:20';
      let author = 'YouTube Music';
      let thumb = 'https://files.catbox.moe/a58add.jpeg';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(rawInput);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library is missing.');
        const searchResults = await yts(rawInput);
        if (!searchResults?.videos?.length) {
          throw new Error('සින්දුව YouTube හි හමු නොවීය!');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || rawInput;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumb = video.thumbnail || thumb;
      } else if (yts) {
        try {
          const ytId = extractYouTubeId(videoUrl);
          if (ytId) {
            const searchResults = await yts({ videoId: ytId });
            if (searchResults && searchResults.title) {
              videoTitle = searchResults.title;
              duration = searchResults.timestamp || duration;
              author = searchResults.author?.name || author;
              thumb = searchResults.thumbnail || thumb;
            }
          }
        } catch (e) {}
      }

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { 
          text: `⚡ *Downloading:* _${videoTitle}_\n⏳ ශ්‍රව්‍ය ගොනුව බාගත කරමින් පවතී...`, 
          edit: statusMsg.key 
        }).catch(() => {});
      }

      // Fetch Stream URL
      const songData = await fetchAudioStream(videoUrl);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();
      if (songData.duration) duration = songData.duration;

      // Thumbnail Image buffer download
      let thumbBuffer;
      try {
        const thumbRes = await axios.get(songData.thumbnail || thumb, { responseType: 'arraybuffer', timeout: 8000 });
        thumbBuffer = Buffer.from(thumbRes.data);
      } catch (e) {
        const fallbackThumb = await axios.get('https://files.catbox.moe/a58add.jpeg', { responseType: 'arraybuffer' });
        thumbBuffer = Buffer.from(fallbackThumb.data);
      }

      // Download Audio Binary Stream
      const audioRes = await axios.get(songData.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 45000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const audioBuffer = Buffer.from(audioRes.data);

      if (!audioBuffer || audioBuffer.length < 5000) {
        throw new Error('බාගත කල Audio ගොනුව දෝෂ සහිතයි.');
      }

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Compact & Clean Card Design
      const songCard = 
`*🎧 HESHAN-MD AUDIO PLAYER*
━━━━━━━━━━━━━━━━━━━━━
• *Track*    : ${cleanTitle.length > 28 ? cleanTitle.slice(0, 25) + '...' : cleanTitle}
• *Artist*   : ${author.length > 24 ? author.slice(0, 21) + '...' : author}
• *Length*   : ${duration}
━━━━━━━━━━━━━━━━━━━━━
🔗 *Pair Site :* https://heshan.devofc.top

> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ*`.trim();

      // 1. Send Card Image
      try {
        await sock.sendMessage(targetChat, {
          image: thumbBuffer,
          caption: songCard,
          contextInfo: channelContext
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard, contextInfo: channelContext }, { quoted: msg }).catch(() => {});
      }

      // 2. Send Playable Audio File
      await sock.sendMessage(targetChat, {
        audio: audioBuffer,
        mimetype: 'audio/mp4',
        fileName: `${cleanTitle}.mp3`,
        ptt: false,
        contextInfo: channelContext
      }, { quoted: msg });

      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song Download Error:', err?.message || err);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, { 
        text: `❌ *Error:* ${err.message || 'සින්දුව බාගත කිරීමට නොහැකි විය.'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};
