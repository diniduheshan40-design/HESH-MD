// commands/song.js
let yts = null;
try {
  yts = require('yt-search');
} catch (e) {}

global.songSessions = global.songSessions || new Map();

module.exports = {
  name: 'song',
  alias: ['play', 'sing', 'mp3', 'ytmp3'],
  category: 'download',
  desc: 'Cyber Pulse Audio Downloader',

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
      let views = '1.2M';
      let ago = 'Recent';
      let thumb = 'https://files.catbox.moe/a58add.jpeg';

      const isYtUrl = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(rawInput);

      if (!isYtUrl) {
        if (!yts) throw new Error('yt-search missing. Install with: npm i yt-search');
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
        views = video.views ? (video.views > 1000000 ? (video.views / 1000000).toFixed(1) + 'M' : (video.views / 1000).toFixed(0) + 'K') : 'Trending';
        thumb = video.thumbnail || thumb;
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
