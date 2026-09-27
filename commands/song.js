// commands/song.js
const axios = require('axios');

let giftedDls = null;
try {
  giftedDls = require('gifted-dls');
} catch (e) {}

let yts = null;
try {
  yts = require('yt-search');
} catch (e) {}

function extractYouTubeId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = String(url).match(regExp);
  return match ? match[1] : null;
}

// ⚡ 100% Working Multi-Engine Audio Stream Fetcher
async function fetchAudioStream(videoUrl) {
  const cleanId = extractYouTubeId(videoUrl);

  // 🥇 Engine 1: Native gifted-dls package (Direct engine in your package.json)
  if (giftedDls && typeof giftedDls.giftedytmp3 === 'function') {
    try {
      const res = await giftedDls.giftedytmp3(videoUrl);
      const dlUrl = res?.result?.download_url || res?.download_url || res?.result?.dl_url;
      if (dlUrl) {
        return {
          downloadUrl: dlUrl,
          title: res?.result?.title || res?.title || 'YouTube Audio',
          thumbnail: res?.result?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
        };
      }
    } catch (e) {}
  }

  // 🥈 Engine 2: Okatsu API (Working High-Speed YouTube MP3)
  try {
    const res2 = await axios.get(`https://api.okatsu.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const dlUrl2 = res2.data?.data?.download || res2.data?.result?.download;
    if (dlUrl2) {
      return {
        downloadUrl: dlUrl2,
        title: res2.data?.data?.title || res2.data?.result?.title || 'YouTube Audio',
        thumbnail: res2.data?.data?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  // 🥉 Engine 3: NexOracle Multi-Stream Engine
  try {
    const res3 = await axios.get(`https://api.nexoracle.com/downloader/yt-audio?apikey=free_key@maher_apis&url=${encodeURIComponent(videoUrl)}`, {
      timeout: 12000
    });
    const dlUrl3 = res3.data?.result?.url || res3.data?.result?.audio;
    if (dlUrl3) {
      return {
        downloadUrl: dlUrl3,
        title: res3.data?.result?.title || 'YouTube Audio',
        thumbnail: res3.data?.result?.thumb || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  // 🏅 Engine 4: Siputzx Fast Endpoint
  try {
    const res4 = await axios.get(`https://api.siputzx.my.id/api/d/youtube/mp3?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 12000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const dlUrl4 = res4.data?.data?.dl;
    if (dlUrl4) {
      return {
        downloadUrl: dlUrl4,
        title: res4.data?.data?.title || 'YouTube Audio',
        thumbnail: res4.data?.data?.thumb || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
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
        image: { url: songData.thumbnail || thumb },
        caption: songCard,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});

      // 2. Direct Stream Audio Dispatch (Channel Context රහිතයි)
      await sock.sendMessage(targetChat, {
        audio: { url: songData.downloadUrl },
        mimetype: 'audio/mp4',
        fileName: `${cleanTitle}.mp3`,
        ptt: false
      }, { quoted: msg });

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
