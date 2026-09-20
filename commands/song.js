// commands/song.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

// ⚡ 2026 Multi-Stream Fast YouTube MP3 Extractors
async function fetchSongAudio(videoUrl) {
  const cleanUrl = encodeURIComponent(videoUrl);

  // 1. Chamindu High-Speed API Gateway
  try {
    const chamUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${cleanUrl}&quality=320kbps&api_key=chama_api_b764539713b0514de0dbb60f401cd69e`;
    const res = await axios.get(chamUrl, { timeout: 8000 });
    const dl = res.data?.download_url || 
               res.data?.data?.download_url || 
               res.data?.data?.url || 
               res.data?.result?.download_url || 
               res.data?.result?.url || 
               res.data?.dl;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 2. David Cyril YouTube API
  try {
    const res = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp3?url=${cleanUrl}`, { timeout: 8000 });
    const dl = res.data?.result?.download_url || res.data?.result?.url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 3. Siputzx Fast Endpoint
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${cleanUrl}`, { timeout: 8000 });
    const dl = res.data?.data?.dl || res.data?.data?.download_url || res.data?.download_url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 4. Vepass Engine
  try {
    const res = await axios.get(`https://api.vepass.top/api/ytmp3?url=${cleanUrl}`, { timeout: 8000 });
    const dl = res.data?.result?.download_url || res.data?.download_url;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  // 5. Okatsu Gateway
  try {
    const res = await axios.get(`https://okatsu-api.vercel.app/api/ytmp3?url=${cleanUrl}`, { timeout: 8000 });
    const dl = res.data?.dl || res.data?.download;
    if (dl && typeof dl === 'string' && dl.startsWith('http')) return dl;
  } catch (e) {}

  throw new Error('සින්දුව බාගත කිරීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.');
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

    // ⚡ Newsletter Forward Badge Context (කාඩ් එකට පමණක් ලබාදීමට)
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
│ 💡 *උදාහරණ:* \`.song Faded\`
│
╰────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    // Step 1: Reaction 🎧
    sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    // Step 2: පොඩි Waiting Message එකක් යැවීම (Badge එකක් නැතුව)
    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⏳ *පොඩ්ඩක් ඉන්න සුදු මැණික...*\nඔයා ඉල්ලපු *"${query}"* සින්දුව හොයන ගමන්... 🎵`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = query;
      let videoTitle = query;
      let duration = 'N/A';
      let author = 'YouTube Music';
      let thumbnail = 'https://files.catbox.moe/a58add.jpeg';
      let views = 'N/A';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(query);

      // YouTube සෙවීම
      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library එක නොමැත.');

        const searchResults = await yts(query);
        if (!searchResults?.videos?.length) {
          throw new Error('සින්දුව සොයාගත නොහැකි විය. කරුණාකර නම නිවැරදිදැයි බලන්න.');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || query;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumbnail = video.thumbnail || thumbnail;
        views = video.views ? Number(video.views).toLocaleString() : views;
      }

      // Audio Download URL එක ලබාගැනීම
      const downloadUrl = await fetchSongAudio(videoUrl);
      const cleanTitle = videoTitle.replace(/[\\/:"*?<>|]/g, '').trim();

      // Step 3: Waiting message එක ක්ෂණිකව Delete කර දැමීම
      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Step 4: සින්දු කාඩ් එක (චැනල් Badge එක සහිතව)
      const songCard = `╭──────❮ 🎵 *HESHAN-MD MUSIC* ❯──────╮
│
├ 🏷️ *Title    :* ${cleanTitle.slice(0, 36)}
├ 👤 *Artist   :* ${author}
├ ⏱️ *Duration :* ${duration}
├ 👁️ *Views    :* ${views}
├ ⚡ *Quality  :* 320kbps High Quality
│
╰────────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

      // ලෝගෝ එක සහ විස්තර කාඩ් එක යැවීම
      try {
        await sock.sendMessage(targetChat, {
          image: { url: thumbnail },
          caption: songCard,
          contextInfo: channelContext // ⚡ මෙතනට පමණක් Channel Badge එක දමා ඇත
        }, { quoted: msg });
      } catch (imgErr) {
        await sock.sendMessage(targetChat, {
          text: songCard,
          contextInfo: channelContext
        }, { quoted: msg }).catch(() => {});
      }

      // Step 5: Audio එක යැවීම (Badge එකක් නැත, කෙලින්ම Player එකේ play වේ)
      await sock.sendMessage(targetChat, {
        audio: { url: downloadUrl },
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
        ptt: false
      }, { quoted: msg });

      // Step 6: සාර්ථකයි Reaction ✅
      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Song download error:', err?.message || err);

      // Error එකක් ආවත් Waiting message එක Delete කර දමයි
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *දෝෂයක් සිදුවිය:* ${err?.message || 'සින්දුව බාගත කිරීමට නොහැකි විය.'}\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`
      }, { quoted: msg }).catch(() => {});
    }
  }
};

