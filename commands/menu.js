// commands/menu.js
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// .setlogo මඟින් save වන local logo path එක
const LOCAL_LOGO = path.join(process.cwd(), 'logo.jpg');
const FALLBACK_LOGO_URL = 'https://files.catbox.moe/a58add.jpeg';

module.exports = {
  name: 'menu',
  category: 'general',
  desc: 'Display all bot command menus',
  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : msg.key.remoteJid;

    const menuText = `╭───❮ ❖ 𝗛 𝗘 𝗦 𝗛 𝗔 𝗡 - 𝗠 𝗗 ❖ ❯───╮
│  ꜱ ɪ ᴍ ᴘ ʟ ᴇ  •  ꜰ ᴀ ꜱ ᴛ  •  ᴘ ᴏ ᴡ ᴇ ʀ ꜰ ᴜ ʟ
│  
│  👋 *Hello! Welcome to Command Menu*
│
│ ╭───❮ 📥 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗-𝗖𝗠𝗗 ❯───
│ ├─◈ .fb
│ ├─◈ .video
│ ├─◈ .song
│ ├─◈ .tiktok
│ ╰─────────────────────────────
│
│ ╭───❮ 🔎 𝗦𝗘𝗔𝗥𝗖𝗛-𝗖𝗠𝗗 ❯──────
│ ├─◈ .srepo
│ ├─◈ .npm
│ ├─◈ .imgg
│ ╰─────────────────────────────
│
│ ╭───❮ 👨‍💻 𝗨𝗦𝗘𝗥-𝗖𝗠𝗗 ❯────────
│ ├─◈ .owner
│ ├─◈ .ping
│ ├─◈ .system
│ ├─◈ .alive
│ ├─◈ .report
│ ├─◈ .boom
│ ╰─────────────────────────────
│
│ ╭───❮ 🔔 𝗔𝗗𝗠𝗜𝗡-𝗖𝗠𝗗 ❯───────
│ ├─◈ .mode
│ ├─◈ .status
│ ├─◈ .save
│ ├─◈ .block
│ ├─◈ .restart
│ ├─◈ .anticall
│ ├─◈ .send-st
│ ╰─────────────────────────────
│
│  > 🔐 ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ
╰───────────────────────────────╯`;

    try {
      // 1. Safe React
      sock.sendMessage(targetChat, {
        react: { text: "📜", key: msg.key }
      }).catch(() => {});

      // 2. Image Selection (Local Custom Logo -> Fallback URL Buffer)
      let imgData = null;

      if (fs.existsSync(LOCAL_LOGO)) {
        // .setlogo මඟින් save කළ image එක තිබේ නම් direct buffer එකක් ලෙස ගනියි
        imgData = fs.readFileSync(LOCAL_LOGO);
      } else {
        try {
          const res = await fetch(FALLBACK_LOGO_URL, { timeout: 8000 });
          if (res.ok) {
            imgData = await res.buffer();
          } else {
            imgData = { url: FALLBACK_LOGO_URL };
          }
        } catch (e) {
          imgData = { url: FALLBACK_LOGO_URL };
        }
      }

      // 3. Send Message with Image
      await sock.sendMessage(targetChat, {
        image: imgData,
        caption: menuText,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        }
      }, { quoted: msg });

    } catch (err) {
      console.error('Error in menu command:', err.message);
      // Fallback: send text only if image strictly fails
      try {
        await sock.sendMessage(targetChat, { text: menuText }, { quoted: msg });
      } catch (fallbackErr) {
        console.error('Fallback send error:', fallbackErr.message);
      }
    }
  }
};
