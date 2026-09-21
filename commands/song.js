// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ Extract clean YouTube Video ID
function extractYouTubeId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// ⚡ Multi-Stream Direct Audio Downloader (SaveTube Engine + 4 Active Fallbacks)
async function fetchSongAudio(videoUrl) {
  const videoId = extractYouTubeId(videoUrl);
  const cleanStandardUrl = videoId 
    ? `https://www.youtube.com/watch?v=${videoId}`
    : videoUrl;

  // 1. Primary: SaveTube High-Speed Engine
  try {
    const cdnRes = await axios.get('https://media.savetube.vip/api/random-cdn', { timeout: 8000 });
    const cdn = cdnRes.data?.cdn || 'cdn51.savetube.su';

    const infoRes = await axios.post(`https://${cdn}/v2/info`, {
      url: cleanStandardUrl
    }, {
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://yt-mp4.net',
        'Referer': 'https://yt-mp4.net/'
      }
    });

    const vData = infoRes.data?.data;
    if (vData && vData.key) {
      const dlRes = await axios.post(`https://${cdn}/download`, {
        downloadType: 'audio',
        quality: '128',
        key: vData.key
      }, {
        timeout: 20000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://yt-mp4.net',
          'Referer': 'https://yt-mp4.net/'
        }
      });

      const dlUrl = dlRes.data?.data?.downloadUrl || dlRes.data?.downloadUrl || dlRes.data?.data?.url;
      if (dlUrl && typeof dlUrl === 'string' && dlUrl.startsWith('http')) {
        return {
          audioUrl: dlUrl,
          title: vData.title || 'YouTube Song',
          thumbnail: vData.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration: vData.durationLabel || 'N/A',
          quality: '128kbps MP3'
        };
      }
    }
  } catch (e) {
    console.error("SaveTube engine error:", e.message);
  }

  // 2. Fallback: BK9 Fun API
  try {
    const res = await axios.get(`https://bk9.fun/download/ytmp3?url=${encodeURIComponent(cleanStandardUrl)}`, { timeout: 15000 });
    const dl = res.data?.BK9?.downloadUrl || res.data?.BK9?.url || res.data?.result?.downloadUrl;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return {
        audioUrl: dl,
        title: res.data?.BK9?.title || 'YouTube Song',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 'N/A',
        quality: '320kbps MP3'
      };
    }
  } catch (e) {}

  // 3. Fallback: Widipe YTDL API
  try {
    const res = await axios.get(`https://widipe.com/download/ytdl?url=${encodeURIComponent(cleanStandardUrl)}`, { timeout: 15000 });
    const dl = res.data?.result?.mp3 || res.data?.result?.audio;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return {
        audioUrl: dl,
        title: res.data?.result?.title || 'YouTube Song',
        thumbnail: res.data?.result?.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 'N/A',
        quality: '128kbps MP3'
      };
    }
  } catch (e) {}

  // 4. Fallback: Vreden API
  try {
    const res = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(cleanStandardUrl)}`, { timeout: 15000 });
    const dl = res.data?.result?.download?.url || res.data?.result?.url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return {
        audioUrl: dl,
        title: res.data?.result?.title || 'YouTube Song',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 'N/A',
        quality: '128kbps MP3'
      };
    }
  } catch (e) {}

  throw new Error('සින්දුව download කරගැනීමට නොහැකි විය. කරුණාකර තත්පර කිහිපයකින් නැවත උත්සාහ කරන්න.');
}

// ⚡ Safe Buffer Stream Fetcher
async function getAudioBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  return Buffer.from(response.data);
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3'],
  category: 'download',
  desc: 'Download YouTube songs in high quality MP3',

  async execute(sock, msg, args, chatJid) {
    const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';

    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // ⚡ Channel Forward Badge Context
    const channelContext = global.channelContext?.contextInfo || {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363421906774107@newsletter',
        newsletterName: '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨',
        serverMessageId: 1
      }
    };

    const query = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    if (!query) {
      return await sock.sendMessage(targetChat, { 
        text: `╭───❮ 🎵 *HESHAN-MD MUSIC* ❯───╮\n│\n│ ⚠️ *Please provide a song title or YouTube link!*\n│ 💡 *Example:* \`.song Lelena\`\n│\n╰────────────────────────────────╯${DEFAULT_FOOTER}`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    // ⚡ Clean Waiting Message
    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Searching & Downloading "${query}"...*\nPlease hold on while we fetch your requested audio. 🎵`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = query;
      let videoTitle = query;
      let duration = 'N/A';
      let author = 'YouTube Music';
      let thumbnail = 'https://files.catbox.moe/a58add.jpeg';
      let views = 'N/A';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      // Search via yt-search if not URL
      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library is missing.');

        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('Song not found! Please check the title and try again.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || query;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : views;
      }

      // 1. Fetch metadata and stream URL
      const songResult = await fetchSongAudio(videoUrl);
      const finalTitle = (songResult.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();
      const finalThumb = songResult.thumbnail || thumbnail;
      const finalDuration = songResult.duration !== 'N/A' ? songResult.duration : duration;

      // 2. Download Audio Buffer
      const audioBuffer = await getAudioBuffer(songResult.audioUrl);

      // 3. Delete searching message
      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // 4. Send Details Card
      const songCard = `╭──────❮ 🎵 *HESHAN-MD MUSIC* ❯──────╮
│
├ 🏷️ *Title    :* ${finalTitle.slice(0, 36)}
├ 👤 *Artist   :* ${author}
├ ⏱️ *Duration :* ${finalDuration}
├ 👁️ *Views    :* ${views}
├ ⚡ *Quality  :* ${songResult.quality}
│
╰────────────────────────────────────╯${DEFAULT_FOOTER}`.trim();

      try {
        await sock.sendMessage(targetChat, {
          image: { url: finalThumb },
          caption: songCard,
          contextInfo: channelContext
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard, contextInfo: channelContext }, { quoted: msg }).catch(() => {});
      }

      // 5. Send Audio File to WhatsApp
      await sock.sendMessage(targetChat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${finalTitle}.mp3`,
        ptt: false
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song execution error:', err.message);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, { 
        text: `❌ *Error:* ${err.message}${DEFAULT_FOOTER}`
      }, { quoted: msg }).catch(() => {});
    }
  }
};

