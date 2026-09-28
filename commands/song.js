// ============================================================================
// 🎵 HESHAN-MD INTERACTIVE SONG CARD & DOWNLOADER (commands/song.js)
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const youtubedl = require('youtube-dl-exec');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

let yts = null;
try {
  yts = require('yt-search');
} catch (e) {}

global.songSessions = global.songSessions || new Map();

/**
 * youtube-dl-exec හරහා Audio එක MP3 එකක් ලෙස බාගත කර Buffer එකක් ලබාගැනීම
 */
async function downloadMp3Buffer(videoUrl) {
  const tempFile = path.join(os.tmpdir(), `yt_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`);
  
  try {
    await youtubedl(videoUrl, {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: '0',
      ffmpegLocation: ffmpegInstaller.path,
      output: tempFile,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    if (!fs.existsSync(tempFile)) {
      throw new Error('Audio conversion failed. File not generated.');
    }

    const audioBuffer = fs.readFileSync(tempFile);
    fs.unlinkSync(tempFile); // Temp file ඉවත් කිරීම
    return audioBuffer;
  } catch (error) {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    throw error;
  }
}

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3', 'ytmp3', 'music'],
  category: 'download',
  desc: 'Cyber Pulse Audio Downloader with Selection Menu',

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

    // ------------------------------------------------------------------------
    // 1. Reply එකක් මගින් 1, 2, 3 තෝරා ඇති දැයි පරීක්ෂා කිරීම (Download Handler)
    // ------------------------------------------------------------------------
    const quotedMsgId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const session = quotedMsgId ? global.songSessions.get(quotedMsgId) : global.songSessions.get(targetChat);

    if (session && ['1', '2', '3'].includes(rawInput)) {
      await sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});
      
      try {
        const audioBuffer = await downloadMp3Buffer(session.videoUrl);

        if (rawInput === '1') {
          // Audio (MP3)
          await sock.sendMessage(targetChat, {
            audio: audioBuffer,
            mimetype: 'audio/mp4',
            fileName: `${session.title}.mp3`,
            contextInfo: channelContext
          }, { quoted: msg });
        } else if (rawInput === '2') {
          // Document (HQ)
          await sock.sendMessage(targetChat, {
            document: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${session.title}.mp3`,
            contextInfo: channelContext
          }, { quoted: msg });
        } else if (rawInput === '3') {
          // Voice (PTT)
          await sock.sendMessage(targetChat, {
            audio: audioBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            contextInfo: channelContext
          }, { quoted: msg });
        }

        await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return;
      } catch (dlErr) {
        console.error('Download Error:', dlErr?.message || dlErr);
        await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(targetChat, {
          text: `❌ *Download දෝෂයකි:* සින්දුව බාගත කිරීමට නොහැකි විය.`,
          contextInfo: channelContext
        }, { quoted: msg });
      }
    }

    // ------------------------------------------------------------------------
    // 2. සින්දුව සෙවීම සහ Interactive Menu Card එක යැවීම
    // ------------------------------------------------------------------------
    if (!rawInput) {
      await sock.sendMessage(targetChat, { react: { text: "🎧", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(targetChat, { 
        text: `*⚡ HESHAN AUDIO BEATS ⚡*\n\n> 💡 කරුණාකර සින්දුවේ නම හෝ YouTube Link එක ඇතුළත් කරන්න.\n> 📌 උදා: *.song Lelena*`,
        contextInfo: channelContext
      }, { quoted: msg });
    }

    await sock.sendMessage(targetChat, { react: { text: "🔎", key: msg.key } }).catch(() => {});

    try {
      let videoUrl = rawInput;
      let videoTitle = rawInput;
      let duration = '03:45';
      let author = 'YouTube Music';
      let views = 'Popular';
      let ago = 'Recent';
      let thumb = 'https://files.catbox.moe/a58add.jpeg';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(rawInput);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search missing. Run: npm i yt-search');
        const searchResults = await yts(rawInput);
        if (!searchResults?.videos?.length) {
          throw new Error('සින්දුව YouTube හි සොයාගත නොහැකි විය!');
        }

        const video = searchResults.videos[0];
        videoUrl = video.url;
        videoTitle = video.title || rawInput;
        duration = video.timestamp || duration;
        author = video.author?.name || author;
        ago = video.ago || ago;
        views = video.views ? (video.views > 1000000 ? (video.views / 1000000).toFixed(1) + 'M' : (video.views / 1000).toFixed(0) + 'K') : views;
        thumb = video.thumbnail || thumb;
      } else {
        if (yts) {
          try {
            const videoIdMatch = rawInput.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
            if (videoIdMatch && videoIdMatch[1]) {
              const videoData = await yts({ videoId: videoIdMatch[1] });
              if (videoData) {
                videoTitle = videoData.title || videoTitle;
                duration = videoData.timestamp || duration;
                author = videoData.author?.name || author;
                thumb = videoData.thumbnail || thumb;
              }
            }
          } catch (e) {}
        }
      }

      let cleanTitle = videoTitle.replace(/[\\/:"*?<>|]/g, '').trim();

      const aestheticCard = 
`⚡𝄢╶╶╶╶ ✦ 🎧 ✦ ╶╶╶╶𝄢⚡
      ◢◤ ʜ ᴇ ꜱ ʜ ᴀ ɴ  ᴏ ꜰ ᴄ ◥◣
   ─── ❖ ꜱᴛᴜᴅɪᴏ ᴇɴɢɪɴᴇ ❖ ───

╭─◈『 𝗧𝗥𝗔𝗖𝗞 𝗜𝗡𝗙𝗢 』◈─╮
│ 🎵 *Title*  : ${cleanTitle}
│ 👤 *Artist* : ${author}
│ ⏱️ *Time*   : ${duration}
│ 👁️ *Views*  : ${views}
│ ⏳ *Age*    : ${ago}
╰─────────────────────╯

 ılı.lıllılı.ıllı. 320ᴋʙᴘꜱ ʜᴅ .ıllı.lıllılı.ıl
 0:00 ───🔘────────── ${duration}
 ⇄   ◃◃   ❙❙   ▹▹   ↻

┌──❮ 📥 𝗦𝗘𝗟𝗘𝗖𝗧 𝗙𝗢𝗥𝗠𝗔𝗧 ❯──┐
│
│  [1]  ▸ 🎵  Audio (MP3)
│  [2]  ▸ 📂  Document (HQ)
│  [3]  ▸ 🎙️  Voice (PTT)
│
└────────────────────────┘
> 💡 *මෙම පණිවිඩයට 1, 2 හෝ 3 ලෙස Reply කරන්න.*
> ⚡ ʜᴇꜱʜᴀɴ.ᴅᴇᴠᴏꜰᴄ.ᴛᴏᴘ • ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ`.trim();

      const sentMsg = await sock.sendMessage(targetChat, {
        image: { url: thumb },
        caption: aestheticCard,
        contextInfo: channelContext
      }, { quoted: msg });

      await sock.sendMessage(targetChat, { react: { text: "🎵", key: msg.key } }).catch(() => {});

      const sessionPayload = {
        videoUrl,
        title: cleanTitle,
        duration,
        thumb,
        sender: msg.key.participant || targetChat,
        time: Date.now()
      };

      if (sentMsg?.key?.id) {
        global.songSessions.set(sentMsg.key.id, sessionPayload);
      }
      global.songSessions.set(targetChat, sessionPayload);

      setTimeout(() => {
        if (sentMsg?.key?.id) global.songSessions.delete(sentMsg.key.id);
        global.songSessions.delete(targetChat);
      }, 15 * 60 * 1000);

    } catch (err) {
      console.error('Song Search Error:', err?.message || err);
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *දෝෂයකි:* ${err.message || 'සින්දුව සෙවීමේදී දෝෂයක් මතු විය.'}`,
        contextInfo: channelContext
      }, { quoted: msg }).catch(() => {});
    }
  }
};
