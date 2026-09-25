// commands/song.js
const axios = require('axios');

let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

const CHAMINDU_API_KEY = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';

function extractYouTubeId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = String(url).match(regExp);
  return match ? match[1] : null;
}

// ⚡ Multi-Engine Audio Stream Fetcher
async function fetchAudioStream(videoUrl, quality = '320kbps') {
  const cleanQuality = quality.replace(/[^0-9]/g, '') + 'kbps';
  const cleanId = extractYouTubeId(videoUrl);

  // Engine 1: Chamindu Site API
  try {
    const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=${cleanQuality}&format=mp3&api_key=${CHAMINDU_API_KEY}`;
    const res = await axios.get(apiUrl, { timeout: 25000 });
    const data = res.data?.data || res.data;
    const dlUrl = data?.direct_url || data?.download_url;

    if (dlUrl) {
      return {
        downloadUrl: dlUrl,
        title: data?.title || 'YouTube Audio',
        thumbnail: data?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg'),
        quality: data?.quality || cleanQuality
      };
    }
  } catch (e) {}

  // Engine 2: Gifted Tech Fallback
  try {
    const res2 = await axios.get(`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(videoUrl)}`, {
      timeout: 25000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const dlUrl2 = res2.data?.result?.download_url || res2.data?.result?.dl_url;

    if (dlUrl2) {
      return {
        downloadUrl: dlUrl2,
        title: res2.data?.result?.title || 'YouTube Audio',
        thumbnail: res2.data?.result?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg'),
        quality: cleanQuality
      };
    }
  } catch (e) {}

  // Engine 3: Siputzx Fallback
  try {
    const res3 = await axios.get(`https://api.siputzx.my.id/api/d/youtube/mp3?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 25000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const dlUrl3 = res3.data?.data?.dl;

    if (dlUrl3) {
      return {
        downloadUrl: dlUrl3,
        title: res3.data?.data?.title || 'YouTube Audio',
        thumbnail: res3.data?.data?.thumb || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg'),
        quality: cleanQuality
      };
    }
  } catch (e) {}

  throw new Error('Download URL generation failed. Please try again.');
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
              `*⚡ ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    let selectedQuality = '320kbps';
    const qualityMatch = rawInput.match(/-(128k|192k|320k)/i);
    if (qualityMatch) {
      selectedQuality = qualityMatch[1].toLowerCase() + 'bps';
      rawInput = rawInput.replace(qualityMatch[0], '').trim();
    }

    sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Fetching:* _${rawInput}_ [${selectedQuality}]...`
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
          throw new Error('Song not found!');
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

      const songData = await fetchAudioStream(videoUrl, selectedQuality);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      // Thumbnail Image buffer download to avoid drop
      let thumbBuffer;
      try {
        const thumbRes = await axios.get(songData.thumbnail || thumb, { responseType: 'arraybuffer', timeout: 12000 });
        thumbBuffer = Buffer.from(thumbRes.data);
      } catch (e) {
        const fallbackThumb = await axios.get('https://files.catbox.moe/a58add.jpeg', { responseType: 'arraybuffer' });
        thumbBuffer = Buffer.from(fallbackThumb.data);
      }

      // Download Audio Binary Stream
      const audioRes = await axios.get(songData.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const audioBuffer = Buffer.from(audioRes.data);

      if (!audioBuffer || audioBuffer.length < 5000) {
        throw new Error('Downloaded audio is corrupted or empty.');
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
• *Quality*  : ${songData.quality}
━━━━━━━━━━━━━━━━━━━━━
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

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song Download Error:', err?.message || err);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, { 
        text: `❌ *Error:* ${err.message || 'සින්දුව බාගත කිරීමට නොහැකි විය.'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};
