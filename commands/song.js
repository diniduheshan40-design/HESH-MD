// commands/song.js
const axios = require('axios');

let yts = null;
try {
  yts = require('yt-search');
} catch (e) {}

function extractYouTubeId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = String(url).match(regExp);
  return match ? match[1] : null;
}

// ⚡ Fast & Crash-Proof Multi-Engine Stream Fetcher
async function fetchAudioStream(videoUrl) {
  const cleanId = extractYouTubeId(videoUrl);

  // 🥇 Engine 1: Dark Yasiya API (Very stable for YouTube Audio)
  try {
    const res1 = await axios.get(`https://www.dark-yasiya-api.site/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const dlUrl1 = res1.data?.result?.dl_link || res1.data?.result?.download;
    if (dlUrl1) {
      return {
        downloadUrl: dlUrl1,
        title: res1.data?.result?.title || 'YouTube Audio',
        thumbnail: res1.data?.result?.thumb || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  // 🥈 Engine 2: NexOracle API
  try {
    const res2 = await axios.get(`https://api.nexoracle.com/downloader/yt-audio?apikey=free_key@maher_apis&url=${encodeURIComponent(videoUrl)}`, {
      timeout: 10000
    });
    const dlUrl2 = res2.data?.result?.url || res2.data?.result?.audio;
    if (dlUrl2) {
      return {
        downloadUrl: dlUrl2,
        title: res2.data?.result?.title || 'YouTube Audio',
        thumbnail: res2.data?.result?.thumb || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  // 🥉 Engine 3: BK9 API
  try {
    const res3 = await axios.get(`https://bk9.fun/download/youtube?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 10000
    });
    const dlUrl3 = res3.data?.BK9?.BK8;
    if (dlUrl3) {
      return {
        downloadUrl: dlUrl3,
        title: res3.data?.BK9?.title || 'YouTube Audio',
        thumbnail: res3.data?.BK9?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  throw new Error('Failed to retrieve download link.');
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3', 'ytmp3'],
  category: 'download',
  desc: 'Download YouTube audio directly',

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
              `> 💡 Please provide a song name or YouTube link.\n` +
              `> 📌 Example: *.song Lelena*\n\n` +
              `🔗 *Pair Site :* https://heshan.devofc.top\n\n` +
              `> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    await sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Searching Track:* _${rawInput}_\n⏳ Searching audio on YouTube...`
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
          throw new Error('Song not found on YouTube!');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || rawInput;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumb = video.thumbnail || thumb;
      }

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { 
          text: `⚡ *Downloading Audio:* _${videoTitle}_\n📥 Sending audio track...`, 
          edit: statusMsg.key 
        }).catch(() => {});
      }

      const songData = await fetchAudioStream(videoUrl);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      // Thumbnail Image එක Buffer කරගැනීම (Timeout 6s)
      let thumbBuffer;
      try {
        const thumbRes = await axios.get(songData.thumbnail || thumb, {
          responseType: 'arraybuffer',
          timeout: 6000
        });
        thumbBuffer = Buffer.from(thumbRes.data);
      } catch (e) {
        const fallback = await axios.get('https://files.catbox.moe/a58add.jpeg', { responseType: 'arraybuffer' });
        thumbBuffer = Buffer.from(fallback.data);
      }

      // Audio ගොනුව Safe Stream Buffer එකක් ලෙස බාගත කිරීම (Timeout 25s)
      const audioRes = await axios.get(songData.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 25000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const audioBuffer = Buffer.from(audioRes.data);

      if (!audioBuffer || audioBuffer.length < 5000) {
        throw new Error('Downloaded audio is corrupted.');
      }

      const songCard = 
`*🎧 HESHAN-MD AUDIO PLAYER*
━━━━━━━━━━━━━━━━━━━━━
• *Track*    : ${cleanTitle.length > 28 ? cleanTitle.slice(0, 25) + '...' : cleanTitle}
• *Artist*   : ${author.length > 24 ? author.slice(0, 21) + '...' : author}
• *Length*   : ${duration}
━━━━━━━━━━━━━━━━━━━━━
🔗 *Pair Site :* https://heshan.devofc.top

> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ*`.trim();

      // 1. Send Card Image (Channel Context සහිතයි)
      await sock.sendMessage(targetChat, {
        image: thumbBuffer,
        caption: songCard,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});

      // 2. Send Audio File (Buffer එකක් ලෙස කෙලින්ම යැවීම - Timeout Guard සහිතයි)
      await Promise.race([
        sock.sendMessage(targetChat, {
          audio: audioBuffer,
          mimetype: 'audio/mp4',
          fileName: `${cleanTitle}.mp3`,
          ptt: false
        }, { quoted: msg }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('WhatsApp upload timed out')), 25000))
      ]);

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song Command Error:', err.message);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, { 
        text: `❌ *Error:* ${err.message || 'Unable to download song.'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};
