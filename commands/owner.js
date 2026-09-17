// commands/owner.js
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  name: 'owner',
  alias: ['creator', 'developer', 'dev', 'hesan'],
  category: 'main',
  desc: 'Ultra-luxurious official owner profile card',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : msg.key.remoteJid;

    try {
      await sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      const ownerNumber = '94719845166';
      const ownerName = '𝐃𝐈𝐍𝐈𝐃𝐔 𝐇𝐄𝐒𝐇𝐀𝐍';
      const ownerCrown = '🤴';

      const profileCaption = `╭─── ⚡ *CORE SYSTEM ARCHITECT* ⚡ ───╮
│
├ 👑 *Developer :* ${ownerName} ${ownerCrown}
├ 🛡️ *Access    :* Master Root [Level 100]
├ 📱 *Hotline   :* +${ownerNumber}
├ 🌐 *Origin    :* Sri Lanka 🇱🇰
├ ⚙️ *Engine    :* HESHAN-MD Ultra V2
│
├─◈ *SYSTEM CREDENTIALS:*
│  ✦ Status: Full Operational Authority
│  ✦ Framework: Baileys Core Multi-Engine
│  ✦ Security: Encrypted Database Vault
│
╰──────────────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

      // 1. Photo එක local storage එකෙන් හෝ external link එකකින් ආරක්ෂිතව ලබාගැනීම
      let imgPayload = null;
      const localPhotoPath = path.join(process.cwd(), 'owner.jpg');

      if (fs.existsSync(localPhotoPath)) {
        imgPayload = fs.readFileSync(localPhotoPath);
      } else {
        // Local file එක නැත්නම් විකල්ප CDN එකකින් Buffer එකක් ලබා ගැනීම
        try {
          const res = await fetch('https://files.catbox.moe/qlulrw.jpeg', { timeout: 5000 });
          if (res.ok) imgPayload = await res.buffer();
        } catch (e) {}
      }

      // 2. Photo එක Caption එක සමඟ යැවීම
      if (imgPayload) {
        await sock.sendMessage(targetChat, {
          image: imgPayload,
          caption: profileCaption
        }, { quoted: msg });
      } else {
        await sock.sendMessage(targetChat, { text: profileCaption }, { quoted: msg });
      }

      // 3. Typewriter Animation එක
      const chars = Array.from(ownerName);
      let animatedText = chars[0];

      let animMsg = await sock.sendMessage(targetChat, { 
        text: `*👑 ARCHITECT :* ${animatedText} ▎` 
      }, { quoted: msg });

      for (let i = 1; i < chars.length; i++) {
        await sleep(280);
        animatedText += chars[i];
        const cursor = (i === chars.length - 1) ? ` ${ownerCrown}` : ' ▎';

        await sock.sendMessage(targetChat, { 
          text: `*👑 ARCHITECT :* ${animatedText}${cursor}`, 
          edit: animMsg.key 
        }).catch(() => {});
      }

      // 4. Clean Contact Card එක
      const vcard = 'BEGIN:VCARD\n'
        + 'VERSION:3.0\n'
        + `FN:${ownerName} ${ownerCrown}\n`
        + `N:${ownerName};;;;${ownerCrown}\n`
        + 'ORG:HESHAN-MD CORE FOUNDATION;\n'
        + 'TITLE:Lead Systems Architect;\n'
        + `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n`
        + 'NOTE:Official Founder & Bot Creator\n'
        + 'END:VCARD';

      await sleep(350);

      await sock.sendMessage(targetChat, {
        contacts: {
          displayName: `${ownerName} ${ownerCrown}`,
          contacts: [{ vcard }]
        }
      }, { quoted: msg });

      await sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("Owner Command Error:", err);
      return sock.sendMessage(targetChat, { text: `❌ *Execution Interrupted:* ${err.message}` }, { quoted: msg });
    }
  }
};
