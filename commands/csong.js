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
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

async function fetchAudioFromChamindu(videoUrl, quality = '320kbps') {
  const cleanQuality = quality.replace(/[^0-9]/g, '') + 'kbps';
  const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(videoUrl)}&quality=${cleanQuality}&format=mp3&api_key=${CHAMINDU_API_KEY}`;

  const res = await axios.get(apiUrl, { timeout: 35000 });
  const data = res.data?.data || res.data;

  const dlUrl = data?.direct_url || data?.download_url;
  if (!dlUrl) throw new Error('Download URL generation failed.');

  return {
    downloadUrl: dlUrl,
    title: data?.title || 'YouTube Audio',
    thumbnail: data?.thumbnail || `https://i.ytimg.com/vi/${extractYouTubeId(videoUrl)}/hqdefault.jpg`,
    quality: data?.quality || cleanQuality
  };
}

module.exports = {
  name: 'csong',
  alias: ['channelsong', 'cplay', 'chsong'],
  category: 'channel',
  desc: 'Download and post high quality song directly into a WhatsApp Channel as voice note (Admin Only)',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // Normal chat එකට පමණක් reply context එක යෙදීම
    const channelContext = global.channelContext?.contextInfo || {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363421906774107@newsletter',
        newsletterName: '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨',
        serverMessageId: 1
      }
    };

    const reply = async (text) => {
      try {
        return await sock.sendMessage(targetChat, { text, contextInfo: channelContext }, { quoted: msg });
      } catch (e) {
        console.error("csong reply error:", e.message);
      }
    };

    // 1. Text Parsing (.csong <channel_link>, <song_name>)
    const fullText = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    if (!fullText.includes(',')) {
      return await reply(
        `*🎧 HESHAN-MD CHANNEL MUSIC*\n\n` +
        `> ⚠️ *වැරදි භාවිතයක්!*\n` +
        `> 💡 *භාවිතය:* \`.csong <චැනල්_ලින්ක්>, <සින්දුවෙ_නම>\`\n` +
        `> 📌 *උදා:* \`.csong https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V, Neth Manema\`\n\n` +
        `*⚡ ʜᴇꜱʜᴀɴ ᴍᴅ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ*`
      );
    }

    const [rawChannel, ...songParts] = fullText.split(',');
    const channelInput = rawChannel.trim();
    let songQuery = songParts.join(',').trim();

    if (!channelInput || !songQuery) {
      return await reply('⚠️ කරුණාකර Channel Link එක සහ සින්දුවේ නම කොමාවකින් (,) වෙන් කර ලබාදෙන්න!');
    }

    // Quality check
    let selectedQuality = '320kbps';
    const qualityMatch = songQuery.match(/-(128k|192k|320k)/i);
    if (qualityMatch) {
      selectedQuality = qualityMatch[1].toLowerCase() + 'bps';
      songQuery = songQuery.replace(qualityMatch[0], '').trim();
    }

    // 2. Resolve Channel JID
    let channelJid = null;
    if (channelInput.includes('@newsletter')) {
      channelJid = channelInput;
    } else {
      const match = channelInput.match(/(?:whatsapp\.com\/channel\/|chat\.whatsapp\.com\/)([a-zA-Z0-9]+)/i);
      if (match && match[1]) {
        try {
          if (typeof sock.newsletterMetadata === 'function') {
            const meta = await sock.newsletterMetadata('invite', match[1]);
            channelJid = meta?.id || null;
          }
        } catch (e) {
          console.error("Channel metadata fetch error:", e.message);
        }
      }
    }

    if (!channelJid) {
      return await reply('❌ වලංගු නොවන Channel Link එකක්! Link එක පරීක්ෂා කර නැවත උත්සාහ කරන්න.');
    }

    sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});

    // 3. Verify Bot Admin Rights in Channel
    let channelName = "WhatsApp Channel";
    try {
      if (typeof sock.newsletterMetadata === 'function') {
        const fullMeta = await sock.newsletterMetadata('jid', channelJid);
        channelName = fullMeta?.name || channelName;

        const myRole = fullMeta?.viewer_metadata?.role?.toLowerCase();
        if (myRole !== 'admin' && myRole !== 'owner') {
          sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
          return await reply(
            `⛔ *Access Denied! Bot Channel Admin නොවේ.*\n\n` +
            `• Channel: *${channelName}*\n` +
            `• Bot Role: *${myRole || 'Subscriber (Member)'}*\n\n` +
            `💡 මෙම Channel එකට Post දැමීමට බොට්ව Admin කෙනෙක් ලෙස පත් කර සිටිය යුතුය.`
          );
        }
      }
    } catch (e) {
      console.error("Newsletter admin validation error:", e.message);
    }

    let statusMsg = await sock.sendMessage(targetChat, {
      text: `⚡ *Processing & Downloading:* _${songQuery}_\n📢 *Target:* ${channelName}...`
    }, { quoted: msg }).catch(() => null);

    try {
      let videoUrl = songQuery;
      let videoTitle = songQuery;
      let duration = 'N/A';
      let author = 'YouTube Music';
      let thumb = 'https://files.catbox.moe/a58add.jpeg';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(songQuery);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search library is missing.');
        const searchResults = await yts(songQuery);
        if (!searchResults?.videos?.length) {
          throw new Error('Song not found!');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || songQuery;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        thumb = video.thumbnail || thumb;
      }

      // Download from Chamindu API
      const songData = await fetchAudioFromChamindu(videoUrl, selectedQuality);
      const cleanTitle = (songData.title || videoTitle).replace(/[\\/:"*?<>|]/g, '').trim();

      const audioRes = await axios.get(songData.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const audioBuffer = Buffer.from(audioRes.data);

      if (statusMsg?.key) {
        await sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // ⚡ Clean Universal Song Card (කොළපාට channel header එකක් නැත - යටින් ʜᴇꜱʜᴀɴ ᴍᴅ පමණි)
      const cleanChannelCard = 
`*🎧 HESHAN-MD AUDIO STREAM*
━━━━━━━━━━━━━━━━━━━━━
• *Track*    : ${cleanTitle.length > 28 ? cleanTitle.slice(0, 25) + '...' : cleanTitle}
• *Artist*   : ${author.length > 24 ? author.slice(0, 21) + '...' : author}
• *Duration* : ${duration}
• *Bitrate*  : ${songData.quality}
━━━━━━━━━━━━━━━━━━━━━
> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`.trim();

      // 4. Send Image Card to Channel (කොළ පාට forwarded header එකක් නැත)
      await sock.sendMessage(channelJid, {
        image: { url: songData.thumbnail || thumb },
        caption: cleanChannelCard
      });

      // 5. Send Audio as Voice Note (PTT) to Channel
      await sock.sendMessage(channelJid, {
        audio: audioBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true
      });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      // Confirm success to requester
      const successNotice = 
`*✅ SONG UPLOADED TO CHANNEL*
━━━━━━━━━━━━━━━━━━━━━
• *Track*    : ${cleanTitle}
• *Channel*  : ${channelName}
• *Mode*     : Voice Note (PTT)
━━━━━━━━━━━━━━━━━━━━━
> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`.trim();

      await sock.sendMessage(targetChat, {
        text: successNotice,
        contextInfo: channelContext
      }, { quoted: msg });

    } catch (err) {
      console.error('Channel Song Error:', err.message);

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});

      await sock.sendMessage(targetChat, {
        text: `❌ *Error:* ${err.message || 'සින්දුව Channel එකට යැවීමට නොහැකි විය.'}\n\n> ⚡ *ʜᴇꜱʜᴀɴ ᴍᴅ*`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};

