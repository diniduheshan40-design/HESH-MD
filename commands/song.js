// commands/spotify.js
const axios = require('axios');

let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

const CHAMINDU_API_KEY = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';

// Fast Multi-Engine Audio Stream Fetcher
async function fetchAudioStream(query) {
  // Engine 1: BK9 API
  try {
    const res = await axios.get(`https://bk9.fun/download/youtube?url=${encodeURIComponent(query)}`, { timeout: 10000 });
    const dlUrl = res.data?.BK9?.BK8;
    if (dlUrl) return dlUrl;
  } catch (e) {}

  // Engine 2: Dark Yasiya API
  try {
    const res2 = await axios.get(`https://www.dark-yasiya-api.site/download/ytmp3?url=${encodeURIComponent(query)}`, { timeout: 10000 });
    const dlUrl2 = res2.data?.result?.dl_link || res2.data?.result?.download;
    if (dlUrl2) return dlUrl2;
  } catch (e) {}

  // Engine 3: Siputzx API
  try {
    const res3 = await axios.get(`https://api.siputzx.my.id/api/d/youtube/mp3?url=${encodeURIComponent(query)}`, { timeout: 10000 });
    const dlUrl3 = res3.data?.data?.dl;
    if (dlUrl3) return dlUrl3;
  } catch (e) {}

  return null;
}

module.exports = {
  name: 'spotify',
  alias: ['sp', 'spot'],
  category: 'download',
  desc: 'Download high quality Spotify tracks',

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

    let query = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    if (!query) {
      return await sock.sendMessage(targetChat, {
        text: `*🟢 HESHAN-MD SPOTIFY DOWNLOADER*\n\n` +
              `> 💡 Spotify Link එකක් හෝ සින්දුවේ නම ලබාදෙන්න.\n` +
              `> 📌 උදා: *.spotify Shape of You*\n` +
              `> 📌 උදා: *.spotify https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3*\n\n` +
              `🔗 *Pair Site :* https://heshan.devofc.top\n\n` +
              `> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    await sock.sendMessage(targetChat, { react: { text: "🟢", key: msg.key } }).catch(() => {});

    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Fetching Spotify Track Info...*`
    }, { quoted: msg }).catch(() => null);

    try {
      let title = query;
      let artist = 'Spotify Artist';
      let duration = '03:30';
      let thumb = 'https://files.catbox.moe/a58add.jpeg';
      let directDownloadUrl = null;

      // 1. Chamindu API එකෙන් Track Metadata ලබාගැනීම
      try {
        const apiUrl = `https://api.chamindu.site/api/v1/spotify/download?q=${encodeURIComponent(query)}&quality=320kbps&api_key=${CHAMINDU_API_KEY}`;
        const res = await axios.get(apiUrl, { timeout: 10000 });
        const data = res.data?.data || res.data?.result;

        if (data && data.title) {
          title = data.title;
          artist = data.artist || artist;
          duration = data.duration || duration;
          thumb = data.thumbnail || thumb;
          directDownloadUrl = data.download_url; // null නොවී තිබුණහොත් කෙලින්ම ගනියි
        }
      } catch (apiErr) {
        console.log("Spotify metadata API skipped/failed:", apiErr.message);
      }

      // 2. Direct download URL එකක් නොලැබුණහොත් (API එකේ download_url: null නිසා) Full Track එක සඳහා YouTube Stream එක සෙවීම
      if (!directDownloadUrl) {
        if (statusMsg?.key) {
          await sock.sendMessage(targetChat, { 
            text: `⚡ *Searching Track:* _${title} - ${artist}_\n⏳ Audio Stream එක සකසමින් පවතී...`, 
            edit: statusMsg.key 
          }).catch(() => {});
        }

        const searchQuery = `${title} ${artist}`.trim();
        let ytUrl = searchQuery;

        if (yts) {
          const searchResults = await yts(searchQuery);
          if (searchResults?.videos?.length) {
            ytUrl = searchResults.videos[0].url;
            duration = duration === '03:30' ? (searchResults.videos[0].timestamp || duration) : duration;
          }
        }

        directDownloadUrl = await fetchAudioStream(ytUrl);
      }

      if (!directDownloadUrl) {
        throw new Error("ගීතය Download කර ගැනීමට Direct Link එකක් හමු නොවීය.");
      }

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { 
          text: `⚡ *Downloading:* _${title}_\n📥 බාගත වෙමින් පවතී...`, 
          edit: statusMsg.key 
        }).catch(() => {});
      }

      // 3. Thumbnail Buffer Download
      let thumbBuffer;
      try {
        const thumbRes = await axios.get(thumb, { responseType: 'arraybuffer', timeout: 8000 });
        thumbBuffer = Buffer.from(thumbRes.data);
      } catch (e) {
        const fallback = await axios.get('https://files.catbox.moe/a58add.jpeg', { responseType: 'arraybuffer' });
        thumbBuffer = Buffer.from(fallback.data);
      }

      // 4. Audio Download
      const audioRes = await axios.get(directDownloadUrl, {
        responseType: 'arraybuffer',
        timeout: 35000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const audioBuffer = Buffer.from(audioRes.data);

      if (!audioBuffer || audioBuffer.length < 5000) {
        throw new Error('බාගත කල Audio ගොනුව දෝෂ සහිතයි.');
      }

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      const cleanTitle = `${title} - ${artist}`.replace(/[\\/:"*?<>|]/g, '').trim();

      const spotifyCard = 
`*🟢 HESHAN-MD SPOTIFY PLAYER*
━━━━━━━━━━━━━━━━━━━━━
• *Track*    : ${title}
• *Artist*   : ${artist}
• *Duration* : ${duration}
• *Platform* : Spotify 🟢
━━━━━━━━━━━━━━━━━━━━━
🔗 *Pair Site :* https://heshan.devofc.top

> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ*`.trim();

      // Send Card Image
      try {
        await sock.sendMessage(targetChat, {
          image: thumbBuffer,
          caption: spotifyCard,
          contextInfo: channelContext
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(targetChat, { text: spotifyCard, contextInfo: channelContext }, { quoted: msg }).catch(() => {});
      }

      // Send Audio
      await sock.sendMessage(targetChat, {
        audio: audioBuffer,
        mimetype: 'audio/mp4',
        fileName: `${cleanTitle}.mp3`,
        ptt: false,
        contextInfo: channelContext
      }, { quoted: msg });

      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Spotify Download Error:', err.message);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, { 
        text: `❌ *Error:* ${err.message || 'Spotify Track එක බාගත කිරීමට නොහැකි විය.'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};
