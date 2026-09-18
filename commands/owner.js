// commands/owner.js
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  name: 'owner',
  alias: ['creator', 'developer', 'dev', 'hesan'],
  category: 'main',
  desc: 'Ultra-luxurious official owner profile card with real typewriter',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : msg.key.remoteJid;

    try {
      // 1. Initial State Reaction
      await sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      const ownerNumber = '94719845166';
      const ownerName = '𝐃𝐈𝐍𝐈𝐃𝐔 𝐇𝐄𝐒𝐇𝐀𝐍';
      const ownerCrown = '🤴';

      // 2. අකුරෙන් අකුර සැබෑ Typewriter Animation එක (Crash-Proof 850ms Rate-Limit Safe Buffer)
      const chars = Array.from(ownerName);
      let currentProgress = chars[0];

      // පළමු අකුර යැවීම
      let animMsg = await sock.sendMessage(targetChat, { 
        text: `*👑 ARCHITECT :* ${currentProgress} ▎` 
      }, { quoted: msg });

      // ඉතිරි අකුරු එකින් එක edit කිරීම
      for (let i = 1; i < chars.length; i++) {
        await sleep(850);
        currentProgress += chars[i];

        const isLastChar = (i === chars.length - 1);
        const cursor = isLastChar ? ` ${ownerCrown}` : ' ▎';

        try {
          await sock.sendMessage(targetChat, { 
            text: `*👑 ARCHITECT :* ${currentProgress}${cursor}`, 
            edit: animMsg.key 
          });
        } catch (editErr) {
          await sleep(1000);
          await sock.sendMessage(targetChat, { 
            text: `*👑 ARCHITECT :* ${currentProgress}${cursor}`, 
            edit: animMsg.key 
          }).catch(() => {});
        }
      }

      await sleep(600);

      // 3. High-Tech Identity Poster Caption
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

      // 4. Photo Buffer ලබා ගැනීම (ඔයාගේ Catbox Link එක)
      let imgPayload = null;
      const localPhotoPath = path.join(process.cwd(), 'owner.jpg');

      if (fs.existsSync(localPhotoPath)) {
        imgPayload = fs.readFileSync(localPhotoPath);
      } else {
        try {
          const res = await fetch('https://files.catbox.moe/0fmhj2.jpeg', { timeout: 8000 });
          if (res.ok) imgPayload = await res.buffer();
        } catch (e) {}
      }

      // 5. Photo එක Caption එක සමඟ යැවීම
      if (imgPayload) {
        await sock.sendMessage(targetChat, {
          image: imgPayload,
          caption: profileCaption
        }, { quoted: msg });
      } else {
        await sock.sendMessage(targetChat, { text: profileCaption }, { quoted: msg });
      }

      // 6. Structured Contact Card
      const vcard = 'BEGIN:VCARD\n'
        + 'VERSION:3.0\n'
        + `FN:${ownerName} ${ownerCrown}\n`
        + `N:${ownerName};;;;${ownerCrown}\n`
        + 'ORG:HESHAN-MD CORE FOUNDATION;\n'
        + 'TITLE:Lead Systems Architect;\n'
        + `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n`
        + 'NOTE:Official Founder & Bot Creator\n'
        + 'END:VCARD';

      await sleep(400);

      // 7. Contact Box එක යැවීම
      await sock.sendMessage(targetChat, {
        contacts: {
          displayName: `${ownerName} ${ownerCrown}`,
          contacts: [{ vcard }]
        }
      }, { quoted: msg });

      // 8. Signature Crown Reaction
      await sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("Owner Command Error:", err);
      return sock.sendMessage(targetChat, { text: `❌ *Error:* ${err.message}` }, { quoted: msg });
    }
  }
};

