// commands/song.js
const axios = require('axios');

let yts = null;
try {
  yts = require('yt-search');
} catch (e) {}

const CHAMINDU_API_KEY = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';
global.songSessions = global.songSessions || new Map();

function extractYouTubeId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = String(url).match(regExp);
  return match ? match[1] : null;
}

// ⚡ High-Speed Audio Engine
async function fetchAudioStream(videoUrl) {
  const cleanId = extractYouTubeId(videoUrl);

  try {
    const apiUrl = `https://api.chamindu.site/api/v1/youtube/mp3?url=${encodeURIComponent(videoUrl)}&quality=320kbps&api_key=${CHAMINDU_API_KEY}`;
    const res = await axios.get(apiUrl, { 
      timeout: 12000, 
      headers: { 'User-Agent': 'Mozilla/5.0' } 
    });
    const data = res.data?.data || res.data?.result;
    const dlUrl = data?.download_url || data?.direct_url;

    if (dlUrl) {
      return {
        downloadUrl: dlUrl,
        title: data?.title || 'YouTube Audio',
        thumbnail: data?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  try {
    const res2 = await axios.get(`https://bk9.fun/download/youtube?url=${encodeURIComponent(videoUrl)}`, { 
      timeout: 10000 
    });
    const dlUrl2 = res2.data?.BK9?.BK8;
    if (dlUrl2) {
      return {
        downloadUrl: dlUrl2,
        title: res2.data?.BK9?.title || 'YouTube Audio',
        thumbnail: res2.data?.BK9?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  throw new Error('Failed to retrieve download link.');
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3', 'ytmp3'],
  category: 'download',
  desc: 'Interactive YouTube Music Downloader',

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
      await sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(targetChat, { 
        text: `*╭━━━〔 ⚡ ʜᴇꜱʜᴀɴ ᴍᴜꜱɪᴄ ⚡ 〕━━━╮*\n` +
              `┃\n` +
              `┃  💡 කරුණාකර සින්දුවේ නම ඇතුළත් කරන්න.\n` +
              `┃  📌 උදා: *.song Lelena*\n` +
              `┃\n` +
              `╰━━━━━━━━━━━━━━━━━━━━━╯\n` +
              `🔗 *Pair Site :* https://heshan.devofc.top`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    await sock.sendMessage(targetChat, { react: { text: "⬆️", key: msg.key } }).catch(() => {});

    try {
      let videoUrl = rawInput;
      let videoTitle = rawInput;
      let duration = '03:20';
      let author = 'YouTube Music';
      let thumb = 'https://files.catbox.moe/a58add.jpeg';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(rawInput);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search missing.');
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

      const cleanTitle = videoTitle.replace(/[\\/:"*?<>|]/g, '').trim();

      const menuCard = 
`╭━━━〔 🎧 *ʜᴇꜱʜᴀɴ ᴍᴜꜱɪᴄ ᴘʟᴀʏᴇʀ* 〕━━━╮
┃ 
┃  🎵 *Track*    : ${cleanTitle.length > 25 ? cleanTitle.slice(0, 22) + '...' : cleanTitle}
┃  👤 *Artist*   : ${author.length > 22 ? author.slice(0, 19) + '...' : author}
┃  ⏱️ *Duration* : ${duration}
┃
┃  ▶ 🔘────────────── ${duration}
┃  ⇄  ◃◃   ❚❚   ▹▹  ↻
┃
┣━━━━━━━━━━━━━━━━━━━━━
┃  📥 *Select format by replying (1-3):*
┃
┃  *[1]* 🎵 Audio (Playable MP3)
┃  *[2]* 📂 Document (Original File)
┃  *[3]* 🎙️ Voice Note (PTT Waveform)
┃
╰━━━━━━━━━━━━━━━━━━━━━╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ*`.trim();

      // Cyber Music Card එක යැවීම
      const sentMsg = await sock.sendMessage(targetChat, {
        image: { url: thumb },
        caption: menuCard,
        contextInfo: channelContext
      }, { quoted: msg });

      // Reply එක හඳුනාගැනීම සඳහා Session Map එකට තොරතුරු සුරැකීම
      if (sentMsg?.key?.id) {
        global.songSessions.set(sentMsg.key.id, {
          videoUrl,
          title: cleanTitle,
          author,
          duration,
          thumb,
          sender: msg.key.participant || targetChat,
          time: Date.now()
        });

        // මිනිත්තු 5කට පසු Session එක ඉවත් කිරීම
        setTimeout(() => {
          global.songSessions.delete(sentMsg.key.id);
        }, 5 * 60 * 1000);
      }

    } catch (err) {
      console.error('Song Search Error:', err?.message || err);
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *Error:* ${err.message || 'Unable to find song.'}\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};
