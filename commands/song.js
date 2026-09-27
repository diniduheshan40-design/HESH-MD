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

// ⚡ 100% Free Multi-Engine MP3 Stream Fetcher
async function fetchVoiceAudioStream(videoUrl) {
  const cleanId = extractYouTubeId(videoUrl);

  // Engine 1: Gifted Tech (High Speed & Unlimited)
  try {
    const res = await axios.get(`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(videoUrl)}`, {
      timeout: 12000,
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

  // Engine 2: David Cyril API
  try {
    const res2 = await axios.get(`https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(videoUrl)}`, {
      timeout: 12000
    });
    const dlUrl2 = res2.data?.result?.download_url;
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
      timeout: 12000
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
              `🔗 *Pair Site :* https://heshan.devofc.top\n\n` +
              `> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    await sock.sendMessage(targetChat, { react: { text: "🎙️", key: msg.key } }).catch(() => {});

    // 🛡️ 1. Safe Channel Identifier Isolation
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
          console.error("Safe caught newsletterMetadata error:", e.message);
        }
      }
    }

    if (!channelJid) {
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(targetChat, {
        text: '❌ *Channel එක සොයාගත නොහැකි විය!*\n\n• Channel Invite Link එක නිවැරදිදැයි බලන්න.\n• Bot අනිවාර්යයෙන් එම Channel එකේ *Admin* විය යුතුය.\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*',
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
          text: `⚡ *Processing:* _${videoTitle}_\n📥 Channel එකට යවමින් පවතී...`, 
          edit: statusMsg.key 
        }).catch(() => {});
      }

      const songData = await fetchVoiceAudioStream(videoUrl);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      // 🎨 1. Photo Card Design
      const cardCaption = 
`🎶 ❝ ${cleanTitle} ❞

0:00 ⊲⊲  ▐ ▌  ⊳⊳ ${timestampStr}
━━━━━⬤───────

\`\`\`Use Headphones For Best Experience.... 🎧🎵\`\`\`

> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`.trim();

      // Card Image Post කිරීම
      await sock.sendMessage(channelJid, {
        image: { url: songData.thumbnail || thumb },
        caption: cardCaption
      });

      await new Promise(r => setTimeout(r, 2000));

      // Direct Stream මඟින් Audio එක Channel එකට යැවීම
      await sock.sendMessage(channelJid, {
        audio: { url: songData.downloadUrl },
        mimetype: 'audio/mp4',
        fileName: `${cleanTitle}.mp3`
      });

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, {
        text: `✅ *Track Uploaded Successfully!*\n\n• *Track:* ${cleanTitle}\n• *Duration:* ${timestampStr}\n• *Channel ID:* \`${channelJid}\`\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`,
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
