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

// ⚡ V3 Multi-Stream Audio Extractor (Direct Thinuzz v3 Engine + Robust Fallbacks)
async function fetchSongAudio(videoUrl) {
  const videoId = extractYouTubeId(videoUrl);
  const cleanStandardUrl = videoId 
    ? `https://www.youtube.com/watch?v=${videoId}`
    : videoUrl;

  const apiKey = 'key_525b5ceb068ac7f2';

  // 1. Primary: Mr Thinuzz v3 All-in-One Engine
  try {
    const v3Url = `https://mr-thinuzz-api-build.vercel.app/api/ytmp4v3/download-all?url=${encodeURIComponent(cleanStandardUrl)}&apiKey=${apiKey}`;
    const res = await axios.get(v3Url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const data = res.data?.data || res.data?.result || res.data;
    
    // Audio link detection from various v3 response formats
    const audioDl = data?.links?.audio || 
                    data?.audios?.[0]?.url || 
                    data?.audios?.[0]?.download || 
                    data?.audio || 
                    data?.download_url || 
                    data?.url;

    if (audioDl && typeof audioDl === 'string' && audioDl.startsWith('http')) {
      return {
        audioUrl: audioDl,
        title: data?.title || 'YouTube Song',
        thumbnail: data?.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: data?.duration || 'N/A',
        quality: data?.quality_found || '320kbps MP3'
      };
    }
  } catch (e) {
    console.error("Thinuzz v3 API error:", e.message);
  }

  // 2. High-Speed Direct Mirror: Siputzx
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(cleanStandardUrl)}`, { timeout: 12000 });
    const dl = res.data?.data?.dl || res.data?.data?.download_url || res.data?.download_url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return {
        audioUrl: dl,
        title: res.data?.data?.title || 'YouTube Song',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 'N/A',
        quality: '128kbps MP3'
      };
    }
  } catch (e) {}

  // 3. High-Speed Direct Mirror: Ryzendesu
  try {
    const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(cleanStandardUrl)}`, { timeout: 12000 });
    const dl = res.data?.url || res.data?.downloadUrl;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return {
        audioUrl: dl,
        title: res.data?.title || 'YouTube Song',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 'N/A',
        quality: '128kbps MP3'
      };
    }
  } catch (e) {}

  throw new Error('Audio download link could not be retrieved. Please retry shortly.');
}

// ⚡ Buffer Stream Fetcher with Referer Support
async function getAudioBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 50000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://savetube.vip/'
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

    // ⚡ Channel Forward Badge Context (Card එකට පමණි)
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

    // ⚡ Clean English Waiting Message (No Badge)
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

      // Search if not direct URL
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

      // Step 1: Fetch download metadata
      const songResult = await fetchSongAudio(videoUrl);
      const finalTitle = (songResult.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();
      const finalThumb = songResult.thumbnail || thumbnail;
      const finalDuration = songResult.duration !== 'N/A' ? songResult.duration : duration;

      // Step 2: Download Audio Buffer
      const audioBuffer = await getAudioBuffer(songResult.audioUrl);

      // Step 3: Delete waiting message
      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Step 4: Send Details Card (With Channel Badge)
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
          contextInfo: channelContext // Card එකට පමණි
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard, contextInfo: channelContext }, { quoted: msg }).catch(() => {});
      }

      // Step 5: Send MP3 Audio to WhatsApp Player (No Badge)
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

