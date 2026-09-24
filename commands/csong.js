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

// 🟢 Heroku + Linux FFmpeg Path Resolver
function getFfmpegPath() {
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) {
      try { fs.chmodSync(staticPath, 0o777); } catch (e) {}
      return staticPath;
    }
  } catch (e) {}
  return 'ffmpeg';
}

const ffmpegBinary = getFfmpegPath();

// 🟢 Channel Waveform Generator
const generateWaveform = () => {
  const waveform = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    waveform[i] = Math.floor(Math.random() * 85) + 15;
  }
  return waveform;
};

// 🟢 High-Quality 48kHz Opus Voice Converter (Heroku Safe)
function convertToOpus(inputBuffer) {
  return new Promise((resolve) => {
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tmpIn = path.join(os.tmpdir(), `in_${uniqueId}.mp3`);
    const tmpOut = path.join(os.tmpdir(), `out_${uniqueId}.ogg`);

    try {
      fs.writeFileSync(tmpIn, inputBuffer);
    } catch (e) {
      return resolve({ buffer: inputBuffer, isOgg: false });
    }

    const cmd = `"${ffmpegBinary}" -y -i "${tmpIn}" -vn -c:a libopus -b:a 96k -vbr on -compression_level 10 -ar 48000 -ac 1 "${tmpOut}"`;

    exec(cmd, (err) => {
      try { fs.unlinkSync(tmpIn); } catch (e) {}
      if (err) {
        console.error("FFmpeg exec error, using MP3 fallback:", err.message);
        return resolve({ buffer: inputBuffer, isOgg: false });
      }

      try {
        if (fs.existsSync(tmpOut)) {
          const opusBuffer = fs.readFileSync(tmpOut);
          try { fs.unlinkSync(tmpOut); } catch (e) {}
          if (opusBuffer && opusBuffer.length > 1000) {
            return resolve({ buffer: opusBuffer, isOgg: true });
          }
        }
      } catch (e) {}
      resolve({ buffer: inputBuffer, isOgg: false });
    });
  });
}

function extractYouTubeId(url) {
  const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return match ? match[1] : null;
}

// ⚡ Ultra-fast Multi-Engine Audio Stream Fetcher
async function fetchVoiceAudioStream(videoUrl) {
  const cleanId = extractYouTubeId(videoUrl);

  // Engine 1: Gifted Tech API
  try {
    const res = await axios.get(`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(videoUrl)}`, {
      timeout: 25000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const dlUrl = res.data?.result?.download_url || res.data?.result?.dl_url;
    if (dlUrl) {
      return {
        downloadUrl: dlUrl,
        title: res.data?.result?.title || 'YouTube Audio',
        thumbnail: res.data?.result?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  // Engine 2: Siputzx API
  try {
    const res2 = await axios.get(`https://api.siputzx.my.id/api/d/youtube/mp3?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 25000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const dlUrl2 = res2.data?.data?.dl;
    if (dlUrl2) {
      return {
        downloadUrl: dlUrl2,
        title: res2.data?.data?.title || 'YouTube Audio',
        thumbnail: res2.data?.data?.thumb || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  // Engine 3: Chamindu API
  try {
    const res3 = await axios.get(`https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=128kbps&format=mp3&api_key=chama_api_ec9848130d1aea209f08fb85e0b4720f`, {
      timeout: 25000
    });
    const chamData = res3.data?.data || res3.data;
    const dlUrl3 = chamData?.direct_url || chamData?.download_url;
    if (dlUrl3) {
      return {
        downloadUrl: dlUrl3,
        title: chamData?.title || 'YouTube Audio',
        thumbnail: chamData?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  throw new Error("ගීතය Download කර ගැනීමට නොහැකි විය. වෙනත් නමකින් හෝ YouTube Link එකකින් උත්සාහ කරන්න.");
}

module.exports = {
  name: 'csong',
  alias: ['channelsong', 'cplay', 'chsong'],
  category: 'channel',
  desc: 'Download and post playable Voice Note and card directly into any WhatsApp Channel via link',

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

    const rawInput = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    // 🎯 ලින්ක් එකටම ඇලෙන්න කොමාව ගැහුවත් වෙන් කර හඳුනා ගැනීම:
    let channelInput = '';
    let songQuery = '';

    if (rawInput.includes(',')) {
      const parts = rawInput.split(',');
      channelInput = parts[0].trim();
      songQuery = parts.slice(1).join(',').trim();
    } else {
      // Space එකකින් වෙන් කර තිබුණහොත්
      const match = rawInput.match(/^(https?:\/\/[^\s]+|[\d]+@newsletter)\s+(.+)$/i);
      if (match) {
        channelInput = match[1].trim();
        songQuery = match[2].trim();
      }
    }

    if (!channelInput || !songQuery) {
      return await sock.sendMessage(targetChat, {
        text: `*🎧 HESHAN-MD CHANNEL MUSIC*\n\n` +
              `> 💡 *භාවිතය:* \`.csong <channel_link>,<song_name/yt_link>\`\n\n` +
              `> 📌 *උදා:* \`.csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V,Lelena\`\n` +
              `> 📌 *උදා 2:* \`.csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V,https://youtu.be/xxx\`\n\n` +
              `*⚡ ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    sock.sendMessage(targetChat, { react: { text: "🎙️", key: msg.key } }).catch(() => {});

    // 🔍 Channel Invite Code එකෙන් Channel JID එක සොයා ගැනීම
    let channelJid = null;
    if (channelInput.endsWith('@newsletter')) {
      channelJid = channelInput;
    } else {
      const inviteCodeMatch = channelInput.match(/(?:whatsapp\.com\/channel\/|chat\.whatsapp\.com\/)([a-zA-Z0-9]+)/i);
      const inviteCode = inviteCodeMatch ? inviteCodeMatch[1] : null;

      if (inviteCode && typeof sock.newsletterMetadata === 'function') {
        try {
          const meta = await sock.newsletterMetadata('invite', inviteCode);
          if (meta?.id) {
            channelJid = meta.id.includes('@newsletter') ? meta.id : `${meta.id}@newsletter`;
          }
        } catch (e) {
          console.error("Newsletter invite error:", e.message);
        }
      }
    }

    if (!channelJid) {
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(targetChat, {
        text: '❌ වලංගු නොවන Channel Link එකක් හෝ Channel එක සොයාගත නොහැකි විය!\n\n*(සටහන: Bot එම Channel එකේ Admin කෙනෙක් විය යුතුය)*',
        contextInfo: channelContext
      }, { quoted: msg });
    }

    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Searching Track:* _${songQuery}_\n📢 Channel එකට සූදානම් කරමින් පවතී...`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = songQuery;
      let videoTitle = songQuery;
      let thumb = 'https://files.catbox.moe/a58add.jpeg';
      let timestampStr = "03:20";

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(songQuery);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library missing.');
        const res = await yts(songQuery);
        if (!res?.videos?.length) throw new Error('සින්දුව YouTube හි සොයාගත නොහැකි විය!');
        videoUrl = res.videos[0].url;
        videoTitle = res.videos[0].title || songQuery;
        thumb = res.videos[0].thumbnail || thumb;
        timestampStr = res.videos[0].timestamp || (res.videos[0].duration ? res.videos[0].duration.timestamp : "03:20");
      } else if (yts) {
        try {
          const ytId = extractYouTubeId(videoUrl);
          if (ytId) {
            const searchResults = await yts({ videoId: ytId });
            if (searchResults && searchResults.title) {
              videoTitle = searchResults.title;
              thumb = searchResults.thumbnail || thumb;
              timestampStr = searchResults.timestamp || (searchResults.duration ? searchResults.duration.timestamp : "03:20");
            }
          }
        } catch (e) {}
      }

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { 
          text: `⚡ *Downloading Audio:* _${videoTitle}_\n📥 Audio stream එක ලබාගනිමින් පවතී...`, 
          edit: statusMsg.key 
        }).catch(() => {});
      }

      const songData = await fetchVoiceAudioStream(videoUrl);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      // Thumbnail Image එක Buffer එකක් කරගැනීම (URL එකක් විදියට යැව්වම Channel වල Drop වෙන එක නවත්වන්න)
      let thumbBuffer;
      try {
        const thumbRes = await axios.get(songData.thumbnail || thumb, { responseType: 'arraybuffer', timeout: 15000 });
        thumbBuffer = Buffer.from(thumbRes.data);
      } catch (e) {
        const fallbackThumb = await axios.get('https://files.catbox.moe/a58add.jpeg', { responseType: 'arraybuffer' });
        thumbBuffer = Buffer.from(fallbackThumb.data);
      }

      // Audio stream එක Download කිරීම
      const audioStream = await axios.get(songData.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const rawAudioBuffer = Buffer.from(audioStream.data);

      if (!rawAudioBuffer || rawAudioBuffer.length < 5000) {
        throw new Error("බාගත කල Audio ගොනුව දෝෂ සහිතයි.");
      }

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { 
          text: `⚡ *Processing:* _${cleanTitle}_\n⚙️ Channel එකට Post කරමින් පවතී...`, 
          edit: statusMsg.key 
        }).catch(() => {});
      }

      // OPUS Conversion
      const { buffer: audioToSend, isOgg } = await convertToOpus(rawAudioBuffer);

      // 🎨 1. Photo Card Design
      const cardCaption = 
`🎶 ❝ ${cleanTitle} ❞

0:00 ⊲⊲  ▐ ▌  ⊳⊳ ${timestampStr}
━━━━━⬤───────

\`\`\`Use Headphones For Best Experience.... 🎧🎵\`\`\`

> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`.trim();

      // 🖼️ STEP 1: Image Card එක Channel එකට යැවීම (No contextInfo to avoid WhatsApp drop)
      await sock.sendMessage(channelJid, {
        image: thumbBuffer,
        caption: cardCaption
      });

      // Channel Rate-limit delay (තත්පර 2.5)
      await new Promise(r => setTimeout(r, 2500));

      // 🎧 STEP 2: Playable Audio එක Channel එකට යැවීම
      try {
        await sock.sendMessage(channelJid, {
          audio: audioToSend,
          mimetype: isOgg ? 'audio/ogg; codecs=opus' : 'audio/mp4',
          ptt: true,
          waveform: generateWaveform()
        });
      } catch (errPTT) {
        console.log("Channel PTT fallback to standard audio:", errPTT.message);
        await sock.sendMessage(channelJid, {
          audio: rawAudioBuffer,
          mimetype: 'audio/mp4',
          ptt: false
        });
      }

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      // පරිශීලකයාට Confirmation මැසේජ් එක යැවීම
      await sock.sendMessage(targetChat, {
        text: `✅ *Track & Card Uploaded Successfully!*\n\n• *Track:* ${cleanTitle}\n• *Duration:* ${timestampStr}\n• *Channel ID:* \`${channelJid}\`\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });

    } catch (err) {
      console.error('Channel audio send error:', err);
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, {
        text: `❌ *Error:* ${err.message || 'සින්දුව යැවීමට නොහැකි විය.'}\n\n*(සටහන: ඔබ ලබාදුන් Link එකේ Bot අනිවාර්යයෙන්ම Channel Admin කෙනෙක් විය යුතුය)*\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};

