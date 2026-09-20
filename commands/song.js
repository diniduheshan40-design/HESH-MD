// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ Thinuzz API & Fallback Stream Extractor
async function fetchSongData(videoUrl) {
  // 1. Primary: Mr Thinuzz API
  try {
    const thinUrl = `https://mr-thinuzz-api-build.vercel.app/api/ytmp3/download?url=${encodeURIComponent(videoUrl)}&apiKey=key_525b5ceb068ac7f2`;
    const res = await axios.get(thinUrl, {
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const data = res.data;
    const audioUrl = data?.data?.links?.audio || 
                     data?.result?.download_url || 
                     data?.result?.url || 
                     data?.download_url || 
                     data?.url;

    if (audioUrl && typeof audioUrl === 'string' && audioUrl.startsWith('http')) {
      return {
        audioUrl,
        title: data?.data?.title || data?.result?.title,
        thumbnail: data?.data?.thumbnail || data?.result?.thumbnail,
        duration: data?.data?.duration || 'N/A',
        quality: data?.data?.quality_found || '128kbps (MP3)'
      };
    }
  } catch (e) {
    console.error("Thinuzz API failed:", e.message);
  }

  // 2. High-Speed Fallback Mirror 1: Siputzx
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 12000 });
    const dl = res.data?.data?.dl || res.data?.data?.download_url || res.data?.download_url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return { audioUrl: dl };
    }
  } catch (e) {}

  // 3. High-Speed Fallback Mirror 2: Ryzendesu
  try {
    const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`, { timeout: 12000 });
    const dl = res.data?.url || res.data?.downloadUrl;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return { audioUrl: dl };
    }
  } catch (e) {}

  throw new Error('සින්දුව ලබා ගැනීමට නොහැකි විය. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.');
}

// ⚡ Buffer Fetcher (WhatsApp Audio Dropping විසඳීමට)
async function getAudioBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 35000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
  });
  return Buffer.from(res.data);
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3'],
  category: 'download',
  desc: 'Download YouTube songs in high quality MP3',

  async execute(sock, msg, args, chatJid) {
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
        text: `╭───❮ 🎵 *HESHAN-MD MUSIC* ❯───╮\n│\n│ ⚠️ *කරුණාකර සින්දුවේ නම හෝ Link එකක් ලබාදෙන්න!*\n│ 💡 *උදාහරණ:* \`.song Lelena\`\n│\n╰────────────────────────────────╯\n> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    // Waiting Message (Badge නැත)
    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⏳ *පොඩ්ඩක් ඉන්න සුදු මැණික...*\nඔයා ඉල්ලපු *"${query}"* සින්දුව බාගත කරමින් පවතී... 🎵`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = query;
      let videoTitle = query;
      let duration = 'N/A';
      let author = 'YouTube Music';
      let thumbnail = 'https://files.catbox.moe/a58add.jpeg';
      let views = 'N/A';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      // Search if not URL
      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library missing');

        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('සින්දුව සොයාගත නොහැකි විය. නම නිවැරදිදැයි බලන්න.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || query;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : views;
      }

      // Audio Link ලබා ගැනීම
      const songResult = await fetchSongData(videoUrl);
      const audioUrl = songResult.audioUrl;
      const finalTitle = (songResult.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();
      const finalThumb = songResult.thumbnail || thumbnail;
      const finalQuality = songResult.quality || '128kbps (MP3)';

      // Audio එක Buffer එකක් විදියට download කිරීම
      const audioBuffer = await getAudioBuffer(audioUrl);

      // Waiting message එක delete කිරීම
      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Song Details Card
      const songCard = `╭──────❮ 🎵 *HESHAN-MD MUSIC* ❯──────╮
│
├ 🏷️ *Title    :* ${finalTitle.slice(0, 36)}
├ 👤 *Artist   :* ${author}
├ ⏱️ *Duration :* ${duration}
├ 👁️ *Views    :* ${views}
├ ⚡ *Quality  :* ${finalQuality}
│
╰────────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

      // Card එක Channel Forward Badge එක සහිතව යැවීම
      try {
        await sock.sendMessage(targetChat, {
          image: { url: finalThumb },
          caption: songCard,
          contextInfo: channelContext
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard, contextInfo: channelContext }, { quoted: msg }).catch(() => {});
      }

      // Audio Buffer එක WhatsApp Player එකට යැවීම (Badge නැත)
      await sock.sendMessage(targetChat, {
        audio: audioBuffer,
        mimetype: 'audio/mp4',
        fileName: `${finalTitle}.mp3`,
        ptt: false
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song execution error:', err?.message || err);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, { 
        text: `❌ *දෝෂයක් සිදු විය:* ${err?.message || 'සින්දුව ලබා ගැනීමට නොහැකි විය.'}\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`
      }, { quoted: msg }).catch(() => {});
    }
  }
};

