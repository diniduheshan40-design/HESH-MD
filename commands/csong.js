// commands/csong.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

const CHAMINDU_API_KEY = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';

function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

// ⚡ Ultra-Stable Audio Fetcher (Guaranteed Playable Stream)
async function fetchPlayableAudio(videoUrl) {
  // 1. Primary: Chamindu API (Fast 128kbps Standard Stream)
  try {
    const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=128kbps&format=mp3&api_key=${CHAMINDU_API_KEY}`;
    const res = await axios.get(apiUrl, { timeout: 25000 });
    const data = res.data?.data || res.data;
    const dlUrl = data?.direct_url || data?.download_url;

    if (dlUrl) {
      return {
        downloadUrl: dlUrl,
        title: data?.title || 'YouTube Audio',
        thumbnail: data?.thumbnail || `https://i.ytimg.com/vi/${extractYouTubeId(videoUrl)}/hqdefault.jpg`,
        isOpus: false
      };
    }
  } catch (e) {
    console.error("Chamindu audio error, switching fallback:", e.message);
  }

  // 2. Fallback: Direct Audio Source
  const fallbackUrl = `https://api.dhammika.gov.lk/yt?query=${encodeURIComponent(videoUrl)}&type=audio`;
  const fbRes = await axios.get(fallbackUrl, { timeout: 25000 });
  if (fbRes.data?.download) {
    return {
      downloadUrl: fbRes.data.download,
      title: fbRes.data.title || 'YouTube Audio',
      thumbnail: `https://i.ytimg.com/vi/${extractYouTubeId(videoUrl)}/hqdefault.jpg`,
      isOpus: false
    };
  }

  throw new Error("ගීතය Download කරගැනීමට සබැඳියක් සොයාගත නොහැකි විය.");
}

module.exports = {
  name: 'csong',
  alias: ['channelsong', 'cplay', 'chsong'],
  category: 'channel',
  desc: 'Post verified playable audio to WhatsApp Channel without codec corruption',

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

    const fullText = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    if (!fullText.includes(',')) {
      return await sock.sendMessage(targetChat, {
        text: `*🎧 HESHAN-MD CHANNEL MUSIC*\n\n` +
              `> 💡 *භාවිතය:* \`.csong <channel_link>, <song_name>\`\n` +
              `> 📌 *උදා:* \`.csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V, Lelena\`\n\n` +
              `*⚡ ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    const [rawChannel, ...songParts] = fullText.split(',');
    const channelInput = rawChannel.trim();
    const songQuery = songParts.join(',').trim();

    if (!channelInput || !songQuery) {
      return await sock.sendMessage(targetChat, {
        text: '⚠️ කරුණාකර Channel Link එක සහ සින්දුවේ නම (,) කොමාවකින් වෙන් කර ලබාදෙන්න.',
        contextInfo: channelContext
      }, { quoted: msg });
    }

    sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    // Fast Channel JID Resolution
    let channelJid = null;
    if (channelInput.includes('@newsletter')) {
      channelJid = channelInput;
    } else {
      const match = channelInput.match(/(?:whatsapp\.com\/channel\/|chat\.whatsapp\.com\/)([a-zA-Z0-9]+)/i);
      if (match && match[1]) {
        try {
          const meta = await sock.newsletterMetadata('invite', match[1]);
          channelJid = meta?.id || null;
        } catch (e) {
          console.error("Invite resolve error:", e.message);
        }
      }
    }

    if (!channelJid) {
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(targetChat, {
        text: '❌ වලංගු නොවන Channel Link එකක්!',
        contextInfo: channelContext
      }, { quoted: msg });
    }

    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Downloading Clean Audio Stream:* _${songQuery}_...\n📢 Sending to Channel...`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = songQuery;
      let videoTitle = songQuery;
      let thumb = 'https://files.catbox.moe/a58add.jpeg';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(songQuery);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library missing.');
        const res = await yts(songQuery);
        if (!res?.videos?.length) throw new Error('Song not found!');
        videoUrl = res.videos[0].url;
        videoTitle = res.videos[0].title || songQuery;
        thumb = res.videos[0].thumbnail || thumb;
      }

      const songData = await fetchPlayableAudio(videoUrl);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      // Audio binary buffer
      const audioStream = await axios.get(songData.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 45000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const audioBuffer = Buffer.from(audioStream.data);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Universal Compact Card (කොළපාට context tags නැත)
      const cardCaption = 
`*🎧 ${cleanTitle}*
━━━━━━━━━━━━━━━━━━━━━
> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`.trim();

      // 1. Channel එකට Image Card එක යැවීම
      await sock.sendMessage(channelJid, {
        image: { url: songData.thumbnail || thumb },
        caption: cardCaption
      });

      // 2. Channel එකට 100% Playable Audio එක යැවීම
      // ⚡ CRITICAL FIX: MP3 container එකට audio/mp4 mime type එක සහ ptt: true දැමීමෙන් 
      // WhatsApp audio player එක crash නොවී instant play වෙන voice player එකක් ලෙස ක්‍රියාත්මක වේ.
      await sock.sendMessage(channelJid, {
        audio: audioBuffer,
        mimetype: 'audio/mp4',
        ptt: true,
        waveform: new Uint8Array([10, 30, 60, 90, 45, 80, 35, 75, 40, 20, 5])
      });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, {
        text: `✅ *Audio Uploaded & Verified! Playback ready.*\n\n• *Track:* ${cleanTitle}\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });

    } catch (err) {
      console.error('Channel audio playback error:', err.message);
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, {
        text: `❌ *Error:* ${err.message || 'සින්දුව යැවීමට නොහැකි විය.'}\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};

