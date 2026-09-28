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

function extractYouTubeId(url) {
  const match = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  return match ? match[1] : null;
}

// ⚡ MP3 Buffer එක WhatsApp Voice Note (OGG Opus) එකක් බවට හරවන function එක
function convertToOpusVoice(inputBuffer) {
  return new Promise((resolve, reject) => {
    const tempInput = path.join(os.tmpdir(), `input_${Date.now()}.mp3`);
    const tempOutput = path.join(os.tmpdir(), `output_${Date.now()}.opus`);

    fs.writeFileSync(tempInput, inputBuffer);

    // ffmpeg හරහා libopus එකෙන් OGG/Opus format එකට convert කිරීම
    exec(`ffmpeg -y -i "${tempInput}" -c:a libopus -b:a 64k -vbr on -compression_level 10 -application voip "${tempOutput}"`, (err) => {
      try { fs.unlinkSync(tempInput); } catch (e) {}

      if (err) {
        // ffmpeg error එකක් ආවොත් මුල් buffer එකම fallback එකක් විදිහට ලබා දීම
        return resolve(inputBuffer);
      }

      try {
        const outBuffer = fs.readFileSync(tempOutput);
        fs.unlinkSync(tempOutput);
        resolve(outBuffer);
      } catch (readErr) {
        resolve(inputBuffer);
      }
    });
  });
}

// ⚡ Multi-Engine MP3 Stream Fetcher (Gifted + Chamindu + Fallbacks)
async function fetchVoiceAudioStream(videoUrl) {
  const cleanId = extractYouTubeId(videoUrl);
  const targetUrl = encodeURIComponent(videoUrl);

  // Engine 1: Gifted Tech (Primary)
  try {
    const res = await axios.get(`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${targetUrl}`, {
      timeout: 20000,
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

  // Engine 2: Chamindu Site API
  try {
    const apiKey = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';
    const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${targetUrl}&quality=320kbps&format=mp3&api_key=${apiKey}`;
    const res2 = await axios.get(apiUrl, { timeout: 25000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const dlUrl2 = res2.data?.download_url || res2.data?.direct_url || res2.data?.data?.download_url;
    if (dlUrl2) {
      return {
        downloadUrl: dlUrl2,
        title: res2.data?.title || res2.data?.data?.title || 'YouTube Audio',
        thumbnail: cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg'
      };
    }
  } catch (e) {}

  // Engine 3: BK9 API
  try {
    const res3 = await axios.get(`https://bk9.fun/download/youtube?url=${targetUrl}`, { timeout: 20000 });
    const dlUrl3 = res3.data?.BK9?.BK8;
    if (dlUrl3) {
      return {
        downloadUrl: dlUrl3,
        title: res3.data?.BK9?.title || 'YouTube Audio',
        thumbnail: res3.data?.BK9?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  throw new Error("ගීතය Download කර ගැනීමට නොහැකි විය. වෙනත් නමකින් උත්සාහ කරන්න.");
}

module.exports = {
  name: 'csong',
  alias: ['channelsong', 'cplay', 'chsong'],
  category: 'channel',
  desc: 'Download and post Audio & Card directly into any WhatsApp Channel',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
    };

    const rawInput = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    // 🎯 Input Split (Comma හෝ Space)
    let channelInput = '';
    let songQuery = '';

    if (rawInput.includes(',')) {
      const firstComma = rawInput.indexOf(',');
      channelInput = rawInput.substring(0, firstComma).trim();
      songQuery = rawInput.substring(firstComma + 1).trim();
    } else {
      const match = rawInput.match(/^(https?:\/\/[^\s]+|[\d]+@newsletter)\s+(.+)$/i);
      if (match) {
        channelInput = match[1].trim();
        songQuery = match[2].trim();
      }
    }

    if (!channelInput || !songQuery) {
      return await reply(
        `*🎧 HESHAN-MD CHANNEL MUSIC*\n\n` +
        `> 💡 *භාවිතය:* \`.csong <channel_link>,<song_name>\`\n\n` +
        `> 📌 *උදා:* \`.csong https://whatsapp.com/channel/0029VbAAjtcC1FuCIiYc8z3T,මා දිහා\`\n\n` +
        `*⚡ ʜᴇꜱʜᴀɴ ᴍᴅ*`
      );
    }

    sock.sendMessage(targetChat, { react: { text: "🎙️", key: msg.key } }).catch(() => {});

    // 🛡️ 1. Safe Channel Extraction
    let channelJid = null;

    if (channelInput.endsWith('@newsletter')) {
      channelJid = channelInput;
    } else {
      const cleanUrl = channelInput.split('?')[0].replace(/\/+$/, '');
      const pathParts = cleanUrl.split('/');
      
      let inviteCode = null;
      for (const part of pathParts) {
        if (/^[a-zA-Z0-9]{20,28}$/.test(part)) {
          inviteCode = part;
          break;
        }
      }

      if (inviteCode && typeof sock.newsletterMetadata === 'function') {
        try {
          const meta = await Promise.race([
            sock.newsletterMetadata('invite', inviteCode),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
          ]);
          if (meta?.id) {
            channelJid = meta.id.includes('@newsletter') ? meta.id : `${meta.id}@newsletter`;
          }
        } catch (e) {
          console.error("Newsletter Metadata Error:", e?.message);
        }
      }
    }

    if (!channelJid) {
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await reply(
        '❌ *Channel එක සොයාගත නොහැකි විය!*\n\n• කරුණාකර Channel Invite Link එක නිවැරදිදැයි බලන්න.\n• Bot අනිවාර්යයෙන්ම එම Channel එකේ *Admin* කෙනෙක් විය යුතුය.'
      );
    }

    let statusMsg = await sock.sendMessage(targetChat, { 
      text: `⚡ *Searching Track:* _${songQuery}_\n📢 Channel එකට සූදානම් කරමින් පවතී...`,
      ...(global.channelContext || {})
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
      }

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { 
          text: `⚡ *Downloading Audio:* _${videoTitle}_\n📥 බාගත වෙමින් පවතී...`, 
          edit: statusMsg.key 
        }).catch(() => {});
      }

      const songData = await fetchVoiceAudioStream(videoUrl);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      // Thumbnail Image Buffer
      let thumbBuffer;
      try {
        const thumbRes = await axios.get(songData.thumbnail || thumb, { responseType: 'arraybuffer', timeout: 15000 });
        thumbBuffer = Buffer.from(thumbRes.data);
      } catch (e) {
        const fallback = await axios.get('https://files.catbox.moe/a58add.jpeg', { responseType: 'arraybuffer' });
        thumbBuffer = Buffer.from(fallback.data);
      }

      // Audio stream download
      const audioStream = await axios.get(songData.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const rawAudioBuffer = Buffer.from(audioStream.data);

      if (!rawAudioBuffer || rawAudioBuffer.length < 5000) {
        throw new Error("Audio ගොනුව ලබාගැනීම අසාර්ථකයි.");
      }

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { 
          text: `⚡ *Converting & Uploading to Channel:* _${cleanTitle}_\n⚙️ Channel එකට Post වෙමින් පවතී...`, 
          edit: statusMsg.key 
        }).catch(() => {});
      }

      // 🎨 1. Photo Card Send
      const cardCaption = 
`🎶 ❝ ${cleanTitle} ❞

0:00 ⊲⊲  ▐ ▌  ⊳⊳ ${timestampStr}
━━━━━⬤───────

\`\`\`Use Headphones For Best Experience.... 🎧🎵\`\`\`

> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`.trim();

      await sock.sendMessage(channelJid, {
        image: thumbBuffer,
        caption: cardCaption
      });

      await new Promise(r => setTimeout(r, 2000));

      // 🎙️ 2. Voice Note Convert & Send
      const voiceBuffer = await convertToOpusVoice(rawAudioBuffer);

      await sock.sendMessage(channelJid, {
        audio: voiceBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true
      });

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      await reply(`✅ *Track Uploaded as Voice Note!*\n\n• *Track:* ${cleanTitle}\n• *Duration:* ${timestampStr}`);

    } catch (err) {
      console.error('Channel audio send error:', err?.message || err);
      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ *Error:* ${err.message || 'සින්දුව යැවීමට නොහැකි විය.'}\n\n*(Bot අනිවාර්යයෙන් Channel එකේ Admin විය යුතුය)*`);
    }
  }
};
