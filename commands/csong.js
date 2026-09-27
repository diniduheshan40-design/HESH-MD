// commands/csong.js
const axios = require('axios');

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

// ⚡ Multi-Engine MP3 Stream Fetcher
async function fetchVoiceAudioStream(videoUrl) {
  const cleanId = extractYouTubeId(videoUrl);

  // Engine 1: Siputzx API
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/youtube/mp3?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const dlUrl = res.data?.data?.dl;
    if (dlUrl) {
      return {
        downloadUrl: dlUrl,
        title: res.data?.data?.title || 'YouTube Audio',
        thumbnail: res.data?.data?.thumb || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  // Engine 2: Gifted Tech API
  try {
    const res2 = await axios.get(`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(videoUrl)}`, {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const dlUrl2 = res2.data?.result?.download_url || res2.data?.result?.dl_url;
    if (dlUrl2) {
      return {
        downloadUrl: dlUrl2,
        title: res2.data?.result?.title || 'YouTube Audio',
        thumbnail: res2.data?.result?.thumbnail || (cleanId ? `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg` : 'https://files.catbox.moe/a58add.jpeg')
      };
    }
  } catch (e) {}

  // Engine 3: BK9 API
  try {
    const res3 = await axios.get(`https://bk9.fun/download/youtube?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 20000
    });
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
      return await sock.sendMessage(targetChat, {
        text: `*🎧 HESHAN-MD CHANNEL MUSIC*\n\n` +
              `> 💡 *භාවිතය:* \`.csong <channel_link>,<song_name>\`\n\n` +
              `> 📌 *උදා:* \`.csong https://whatsapp.com/channel/0029VbAAjtcC1FuCIiYc8z3T,මා දිහා\`\n\n` +
              `*⚡ ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    await sock.sendMessage(targetChat, { react: { text: "🎙️", key: msg.key } }).catch(() => {});

    // 🛡️ 1. Safe Channel Extraction (Never Crash)
    let channelJid = null;

    if (channelInput.endsWith('@newsletter')) {
      channelJid = channelInput;
    } else {
      // Post ID (/626 හෝ වෙනත්) අයින් කර Invite Code එක පමණක් වෙන් කර ගැනීම
      const cleanUrl = channelInput.split('?')[0].replace(/\/+$/, '');
      const pathParts = cleanUrl.split('/');
      
      // whatsapp.com/channel/0029Vb.../626 ආවොත් 0029... කොටස ගැනීම
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
          console.error("Safe caught newsletterMetadata error:", e.message);
        }
      }
    }

    // Channel එක හොයාගන්න බැරි නම් Bot restart නොවී කෙලින්ම Message එක යවා නවත්වයි
    if (!channelJid) {
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(targetChat, {
        text: '❌ *Channel එක සොයාගත නොහැකි විය!*\n\n• කරුණාකර Channel Invite Link එක නිවැරදිදැයි බලන්න.\n• Bot අනිවාර්යයෙන්ම එම Channel එකේ *Admin* කෙනෙක් විය යුතුය.\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*',
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
          text: `⚡ *Uploading to Channel:* _${cleanTitle}_\n⚙️ Channel එකට Post වෙමින් පවතී...`, 
          edit: statusMsg.key 
        }).catch(() => {});
      }

      // 🎨 1. Photo Card
      const cardCaption = 
`🎶 ❝ ${cleanTitle} ❞

0:00 ⊲⊲  ▐ ▌  ⊳⊳ ${timestampStr}
━━━━━⬤───────

\`\`\`Use Headphones For Best Experience.... 🎧🎵\`\`\`

> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`.trim();

      // Card එක Post කිරීම
      await sock.sendMessage(channelJid, {
        image: thumbBuffer,
        caption: cardCaption
      });

      await new Promise(r => setTimeout(r, 2000));

      // Audio එක Post කිරීම
      await sock.sendMessage(channelJid, {
        audio: rawAudioBuffer,
        mimetype: 'audio/mp4',
        fileName: `${cleanTitle}.mp3`
      });

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, {
        text: `✅ *Track Uploaded Successfully!*\n\n• *Track:* ${cleanTitle}\n• *Duration:* ${timestampStr}\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });

    } catch (err) {
      console.error('Channel audio send error:', err.message);
      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, {
        text: `❌ *Error:* ${err.message || 'සින්දුව යැවීමට නොහැකි විය.'}\n\n*(Bot අනිවාර්යයෙන් Channel එකේ Admin විය යුතුය)*\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};
