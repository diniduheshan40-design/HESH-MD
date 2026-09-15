module.exports = {
    name: 'menu',
    async execute(sock, msg, args, chatJid) {
        // chatJid එක තහවුරු කර ගැනීම
        const targetChat = chatJid || msg.key.remoteJid;

        // Logo Direct URL
        const logoUrl = 'https://files.catbox.moe/a58add.jpeg';

        // මෙනූ Text එක try එකෙන් පිටත declare කර ඇත (ReferenceError වැළැක්වීමට)
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
            // 1. Command එක ආපු ගමන් 📜 React කරනවා
            await sock.sendMessage(targetChat, {
                react: {
                    text: "📜",
                    key: msg.key
                }
            });

            // 2. Image එක සහිතව යැවීම
            await sock.sendMessage(targetChat, {
                image: { url: logoUrl },
                caption: menuText,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true
                }
            }, { quoted: msg });

        } catch (err) {
            console.error('Error in menu command:', err);
            // Image fail වුණොත් Text එක පමණක් යවයි
            try {
                await sock.sendMessage(targetChat, { text: menuText }, { quoted: msg });
            } catch (fallbackErr) {
                console.error('Fallback send error:', fallbackErr);
            }
        }
    }
};
