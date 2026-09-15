module.exports = {
  name: 'menu',
  category: 'general',
  desc: 'Display all bot command menus',
  async execute(sock, msg, args, chatJid) {
    const targetChat = chatJid || msg.key.remoteJid;
    const logoUrl = 'https://files.catbox.moe/a58add.jpeg';

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
      try {
        await sock.sendMessage(targetChat, {
          react: {
            text: "📜",
            key: msg.key
          }
        });
      } catch (e) {}

      // 2. Send Image with Context Info
      await sock.sendMessage(targetChat, {
        image: { url: logoUrl },
        caption: menuText,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        }
      }, { quoted: msg });

    } catch (err) {
      console.error('Error in menu command:', err.message);
      // Fallback: send text only if image fails
      try {
        await sock.sendMessage(targetChat, { text: menuText }, { quoted: msg });
      } catch (fallbackErr) {
        console.error('Fallback send error:', fallbackErr.message);
      }
    }
  }
};
