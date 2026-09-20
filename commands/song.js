// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ YouTube Video ID Extract Helper
function extractYouTubeId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// ⚡ Thinuzz Paid API Direct Integration
async function fetchSongData(videoUrl) {
  // Always convert to full standard YouTube URL
  const videoId = extractYouTubeId(videoUrl);
  const cleanStandardUrl = videoId 
    ? `https://www.youtube.com/watch?v=jvWTIvk2Wss`.replace('jvWTIvk2Wss', videoId)
    : videoUrl;

  const apiKey = 'key_525b5ceb068ac7f2';
  const apiUrl = `https://mr-thinuzz-api-build.vercel.app/api/ytmp3/download?url=${encodeURIComponent(cleanStandardUrl)}&apiKey=${apiKey}`;

  console.log(`[SONG API] Calling Thinuzz API for: ${cleanStandardUrl}`);

  const res = await axios.get(apiUrl, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const body = res.data;
  const audioUrl = body?.data?.links?.audio;

  if (!audioUrl) {
    throw new Error('API එකෙන් Audio Link එක ලබාගත නොහැකි විය.');
  }

  return {
    audioUrl: audioUrl,
    title: body?.data?.title || 'Unknown Song',
    thumbnail: body?.data?.thumbnail || 'https://files.catbox.moe/a58add.jpeg',
    duration: body?.data?.duration || 'N/A',
    quality: body?.data?.quality_found || '128kbps (MP3)'
  };
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
        text: `╭───❮ 🎵 *HESHAN-MD MUSIC* ❯───╮\n│\n│ ⚠️ *කරුණාකර සින්දුවේ නම ලබාදෙන්න!*\n│ 💡 *උදාහරණ:* \`.song Lelena\`\n│\n╰────────────────────────────────╯\n> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    // Step 1: Waiting Message (Badge නැත)
    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⏳ *පොඩ්ඩක් ඉන්න සුදු මැණික...*\nඔයා ඉල්ලපු *"${query}"* සින්දුව බාගත කරමින් පවතී... 🎵`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = query;
      let videoTitle = query;
      let author = 'YouTube Music';
      let views = 'N/A';
      let duration = 'N/A';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      // Search Query Logic
      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search package එක install කර නොමැත.');

        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('සින්දුව සොයාගත නොහැකි විය. නම නිවැරදිදැයි බලන්න.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || query;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        views = video.views ? Number(video.views).toLocaleString() : views;
      }

      // Step 2: Call Thinuzz API
      const songData = await fetchSongData(videoUrl);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      // Step 3: Stream download audio buffer (Axios Stream to Buffer)
      console.log(`[SONG API] Fetching audio buffer from: ${songData.audioUrl}`);
      const audioStreamRes = await axios.get(songData.audioUrl, {
        responseType: 'arraybuffer',
        timeout: 45000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://savetube.vip/'
        }
      });
      const audioBuffer = Buffer.from(audioStreamRes.data);

      // Step 4: Waiting message එක Delete කිරීම
      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Step 5: Song Details Card එක යැවීම
      const songCard = `╭──────❮ 🎵 *HESHAN-MD MUSIC* ❯──────╮
│
├ 🏷️ *Title    :* ${cleanTitle.slice(0, 36)}
├ 👤 *Artist   :* ${author}
├ ⏱️ *Duration :* ${songData.duration !== 'N/A' ? songData.duration : duration}
├ 👁️ *Views    :* ${views}
├ ⚡ *Quality  :* ${songData.quality}
│
╰────────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

      try {
        await sock.sendMessage(targetChat, {
          image: { url: songData.thumbnail },
          caption: songCard,
          contextInfo: channelContext // ⚡ මෙතනට පමණක් Channel Badge එක
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard, contextInfo: channelContext }, { quoted: msg }).catch(() => {});
      }

      // Step 6: Audio File එක WhatsApp එකට Push කිරීම (Direct Buffer)
      await sock.sendMessage(targetChat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
        ptt: false
      }, { quoted: msg });

      // Step 7: Success Reaction
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

