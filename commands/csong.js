// commands/csong.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

let yts;
try {
  yts = require('yt-search');
} catch (e) {
  yts = null;
}

let ffmpegPath = 'ffmpeg';
try {
  const staticFfmpeg = require('ffmpeg-static');
  if (staticFfmpeg) ffmpegPath = staticFfmpeg;
} catch (e) {}

// 🟢 Channel Waveform Generator
const generateWaveform = () => {
  const waveform = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    waveform[i] = Math.floor(Math.random() * 85) + 15;
  }
  return waveform;
};

// 🟢 High-Quality OPUS Audio Converter (Music-optimized 48kHz)
function convertToOpus(inputBuffer) {
  return new Promise((resolve, reject) => {
    const tmpIn = path.join(os.tmpdir(), `in_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`);
    const tmpOut = path.join(os.tmpdir(), `out_${Date.now()}_${Math.random().toString(36).substring(7)}.ogg`);

    fs.writeFileSync(tmpIn, inputBuffer);
    try { fs.chmodSync(ffmpegPath, 0o777); } catch (e) {}

    // 🎵 Music application, 48000Hz stereo/mono, 96k bitrate for high quality voice note
    const cmd = `"${ffmpegPath}" -y -i "${tmpIn}" -vn -c:a libopus -b:a 96k -vbr on -compression_level 10 -frame_duration 20 -application audio -ar 48000 "${tmpOut}"`;

    exec(cmd, (err) => {
      try { fs.unlinkSync(tmpIn); } catch (e) {}
      if (err) {
        console.error("FFmpeg error:", err);
        return reject(new Error("FFmpeg Conversion Failed"));
      }

      try {
        const opusBuffer = fs.readFileSync(tmpOut);
        try { fs.unlinkSync(tmpOut); } catch (e) {}
        if (!opusBuffer || opusBuffer.length < 1024) return reject(new Error("Corrupted Audio Output"));
        resolve(opusBuffer);
      } catch (e) {
        reject(e);
      }
    });
  });
}

function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

// ⚡ Multi-Engine YouTube MP3 Fetcher
async function fetchVoiceAudioStream(videoUrl) {
  const cleanId = extractYouTubeId(videoUrl);

  // Engine 1: Gifted Tech Direct
  try {
    const res = await axios.get(`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(videoUrl)}`, {
      timeout: 20000
    });
    const dlUrl = res.data?.result?.download_url || res.data?.result?.dl_url;
    if (dlUrl) {
      return {
        downloadUrl: dlUrl,
        title: res.data?.result?.title || 'YouTube Music',
        thumbnail: res.data?.result?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : null)
      };
    }
  } catch (e) {}

  // Engine 2: Chamindu Site API
  try {
    const chamRes = await axios.get(`https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=128kbps&format=mp3&api_key=chama_api_ec9848130d1aea209f08fb85e0b4720f`, {
      timeout: 20000
    });
    const chamData = chamRes.data?.data || chamRes.data;
    const chamUrl = chamData?.direct_url || chamData?.download_url;
    if (chamUrl) {
      return {
        downloadUrl: chamUrl,
        title: chamData?.title || 'YouTube Music',
        thumbnail: chamData?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : null)
      };
    }
  } catch (e) {}

  // Engine 3: Dark Yahu Secondary Fallback
  try {
    const fallbackRes = await axios.get(`https://api.siputzx.my.id/api/d/youtube/mp3?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 20000
    });
    const fbUrl = fallbackRes.data?.data?.dl;
    if (fbUrl) {
      return {
        downloadUrl: fbUrl,
        title: fallbackRes.data?.data?.title || 'YouTube Music',
        thumbnail: fallbackRes.data?.data?.thumb || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : null)
      };
    }
  } catch (e) {}

  throw new Error("ගීතය Download කර ගැනීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න.");
}

module.exports = {
  name: 'csong',
  alias: ['channelsong', 'cplay', 'chsong'],
  category: 'channel',
  desc: 'Download and post high-quality playable audio directly into a WhatsApp Channel',

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

    // Channel ID Resolver
    let channelJid = null;
    if (channelInput.endsWith('@newsletter')) {
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
        text: '❌ වලංගු නොවන Channel Link එකක් හෝ Channel එක සොයාගත නොහැකි විය!',
        contextInfo: channelContext
      }, { quoted: msg });
    }

    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Searching & Downloading:* _${songQuery}_\n📢 Channel එකට සූදානම් කරමින් පවතී...`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = songQuery;
      let videoTitle = songQuery;
      let thumb = 'https://files.catbox.moe/a58add.jpeg';
      let timestampStr = "0:00";

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(songQuery);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library missing.');
        const res = await yts(songQuery);
        if (!res?.videos?.length) throw new Error('සින්දුව සොයා ගැනීමට නොහැකි විය!');
        videoUrl = res.videos[0].url;
        videoTitle = res.videos[0].title || songQuery;
        thumb = res.videos[0].thumbnail || thumb;
        timestampStr = res.videos[0].timestamp || (res.videos[0].duration ? res.videos[0].duration.timestamp : "0:00");
      } else if (yts) {
        try {
          const ytId = extractYouTubeId(videoUrl);
          const searchResults = await yts({ videoId: ytId });
          if (searchResults && searchResults.title) {
            videoTitle = searchResults.title;
            thumb = searchResults.thumbnail || thumb;
            timestampStr = searchResults.timestamp || (searchResults.duration ? searchResults.duration.timestamp : "0:00");
          }
        } catch (e) {}
      }

      const songData = await fetchVoiceAudioStream(videoUrl);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      // Download raw audio
      const audioStream = await axios.get(songData.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const rawAudioBuffer = Buffer.from(audioStream.data);

      if (!rawAudioBuffer || rawAudioBuffer.length < 10000) {
        throw new Error("බාගත කල audio ගොනුව දෝෂ සහිතයි.");
      }

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { 
          text: `⚡ *Processing Voice Audio:* _${cleanTitle}_\n⚙️ High Quality Audio වලට Convert කරමින් පවතී...`, 
          edit: statusMsg.key 
        }).catch(() => {});
      }

      // Convert to WhatsApp Native Opus
      const finalAudioBuffer = await convertToOpus(rawAudioBuffer);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // 🎨 Card Design
      const cardCaption = 
`🎶 ❝ ${cleanTitle} ❞

0:00 ⊲⊲  ▐ ▌  ⊳⊳ ${timestampStr}
━━━━━⬤───────

\`\`\`Use Headphones For Best Experience.... 🎧🎵\`\`\`

> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`.trim();

      // 1. Image Card to Channel
      await sock.sendMessage(channelJid, {
        image: { url: songData.thumbnail || thumb },
        caption: cardCaption
      });

      // 2. Safe Delay
      await new Promise(r => setTimeout(r, 2500));

      // 3. Audio upload to Channel
      try {
        await sock.sendMessage(channelJid, {
          audio: finalAudioBuffer,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true,
          waveform: generateWaveform()
        });
      } catch (errChannelPtt) {
        // Fallback: If channel rejects PTT voice note format
        await sock.sendMessage(channelJid, {
          audio: rawAudioBuffer,
          mimetype: 'audio/mp4',
          ptt: false
        });
      }

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, {
        text: `✅ *Track Uploaded Successfully!*\n\n• *Track:* ${cleanTitle}\n• *Duration:* ${timestampStr}\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`,
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

