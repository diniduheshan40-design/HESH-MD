// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ Thinuzz API Gateway (Direct JSON Structure Integration)
async function fetchSongData(videoUrl) {
  const cleanUrl = encodeURIComponent(videoUrl);

  // 1. Primary: Mr Thinuzz API
  try {
    const apiUrl = `https://mr-thinuzz-api-build.vercel.app/api/ytmp3/download?url=${cleanUrl}&apiKey=key_525b5ceb068ac7f2`;
    const res = await axios.get(apiUrl, { timeout: 20000 });
    
    // API JSON Key Extraction: data.links.audio
    const audioUrl = res.data?.data?.links?.audio;
    if (audioUrl && typeof audioUrl === 'string' && audioUrl.startsWith('http')) {
      return {
        audioUrl,
        title: res.data?.data?.title,
        thumbnail: res.data?.data?.thumbnail,
        duration: res.data?.data?.duration,
        quality: res.data?.data?.quality_found || '128kbps (MP3)'
      };
    }
  } catch (e) {
    console.error("Thinuzz API failed, switching to backup:", e.message);
  }

  // 2. High-Speed Fallback: Siputzx
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${cleanUrl}`, { timeout: 10000 });
    const dl = res.data?.data?.dl || res.data?.data?.download_url || res.data?.download_url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return { audioUrl: dl };
    }
  } catch (e) {}

  // 3. High-Speed Fallback: Ryzendesu
  try {
    const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp3?url=${cleanUrl}`, { timeout: 10000 });
    const dl = res.data?.url || res.data?.downloadUrl;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) {
      return { audioUrl: dl };
    }
  } catch (e) {}

  throw new Error('සින්දුව ලබා ගැනීමට නොහැකි විය. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.');
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

    // ⚡ Newsletter Forward Badge Context (Image Card එකට පමණි)
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
        text: `╭───❮ 🎵 *HESHAN-MD MUSIC* ❯───╮
│
│ ⚠️ *කරුණාකර සින්දුවේ නම හෝ Link එකක් ලබාදෙන්න!*
│ 💡 *උදාහරණ:* \`.song Lelena\`
│
╰────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    // Step 1: Reaction 🎧
    sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    // Step 2: Waiting Message (චැනල් Badge නැත)
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

      // YouTube සෙවීම (Query එක direct link එකක් නොවේ නම්)
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

      // Step 3: Audio දත්ත ලබා ගැනීම (API එකෙන්)
      const songResult = await fetchSongData(videoUrl);
      const audioUrl = songResult.audioUrl;
      const finalTitle = (songResult.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();
      const finalThumb = songResult.thumbnail || thumbnail;
      const finalQuality = songResult.quality || '320kbps High Quality';

      // Step 4: Waiting Message එක ක්ෂණිකව Delete කර දැමීම
      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Step 5: Song Details Card එක සෑදීම
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
          contextInfo: channelContext // ⚡ මෙතනට පමණක් Channel Badge එක දමා ඇත
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: songCard, contextInfo: channelContext }, { quoted: msg }).catch(() => {});
      }

      // Step 6: Audio එක WhatsApp Player එකට යැවීම (Badge නැත)
      await sock.sendMessage(targetChat, {
        audio: { url: audioUrl },
        mimetype: 'audio/mp4',
        fileName: `${finalTitle}.mp3`,
        ptt: false
      }, { quoted: msg });

      // Step 7: සාර්ථක Reaction ✅
      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song download execution error:', err?.message || err);

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

