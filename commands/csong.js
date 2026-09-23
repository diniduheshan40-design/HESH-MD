// commands/csong.js
const axios = require('axios');
let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

// ⚡ Ultra-fast Native WhatsApp Voice Stream Fetcher
async function fetchVoiceAudioStream(videoUrl) {
  // 1. Primary Engine: Direct Opus / Native Voice Audio API
  try {
    const res = await axios.get(`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(videoUrl)}`, {
      timeout: 30000
    });
    const dlUrl = res.data?.result?.download_url || res.data?.result?.dl_url;
    if (dlUrl) {
      return {
        downloadUrl: dlUrl,
        title: res.data?.result?.title || 'YouTube Audio',
        thumbnail: res.data?.result?.thumbnail || `https://i.ytimg.com/vi/${extractYouTubeId(videoUrl)}/hqdefault.jpg`
      };
    }
  } catch (e) {
    console.error("Primary voice engine error, using fallback:", e.message);
  }

  // 2. Secondary Engine: Chamindu Direct Fallback
  const chamRes = await axios.get(`https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=128kbps&format=mp3&api_key=chama_api_ec9848130d1aea209f08fb85e0b4720f`, {
    timeout: 30000
  });
  const chamData = chamRes.data?.data || chamRes.data;
  const chamUrl = chamData?.direct_url || chamData?.download_url;

  if (chamUrl) {
    return {
      downloadUrl: chamUrl,
      title: chamData?.title || 'YouTube Audio',
      thumbnail: chamData?.thumbnail || `https://i.ytimg.com/vi/${extractYouTubeId(videoUrl)}/hqdefault.jpg`
    };
  }

  throw new Error("ගීතය ලබාගැනීමට නොහැකි විය.");
}

module.exports = {
  name: 'csong',
  alias: ['channelsong', 'cplay', 'chsong'],
  category: 'channel',
  desc: 'Download and post playable Voice Note directly into a WhatsApp Channel',

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

    sock.sendMessage(targetChat, { react: { text: "🎙️", key: msg.key } }).catch(() => {});

    // Channel ID Extraction
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
      text: `⚡ *Processing Voice Audio:* _${songQuery}_\n📢 Sending to Channel...`
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

      const songData = await fetchVoiceAudioStream(videoUrl);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      // Binary Audio Stream Buffer
      const audioStream = await axios.get(songData.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 45000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const audioBuffer = Buffer.from(audioStream.data);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Universal Compact Card
      const cardCaption = 
`*🎧 ${cleanTitle}*
━━━━━━━━━━━━━━━━━━━━━
> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`.trim();

      // 1. Channel එකට Image Card එක යැවීම
      await sock.sendMessage(channelJid, {
        image: { url: songData.thumbnail || thumb },
        caption: cardCaption
      });

      // 2. Channel එකට 100% Play වෙන Native Voice Note එකක් විදියට යැවීම
      // 💡 Baileys official audio/mp4 container + ptt:true playback standard
      await sock.sendMessage(channelJid, {
        audio: audioBuffer,
        mimetype: 'audio/mp4',
        ptt: true
      });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, {
        text: `✅ *Voice Note Uploaded & Ready to Play!*\n\n• *Track:* ${cleanTitle}\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });

    } catch (err) {
      console.error('Channel audio send error:', err);
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

