// commands/owner.js
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
      // 1. Initial State Reaction
      await sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      const ownerNumber = '94719845166';
      const ownerPhotoUrl = 'https://files.catbox.moe/qlulrw.jpeg';
      const ownerName = '𝐃𝐈𝐍𝐈𝐃𝐔 𝐇𝐄𝐒𝐇𝐀𝐍';
      const ownerCrown = '🤴';

      // 2. High-Tech Glassmorphic Identity Poster Caption
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

      // 3. Photo එක Download කර ආරක්ෂිතව යැවීම (ECONNREFUSED වැළැක්වීමේ fallback එක සහිතයි)
      let photoSent = false;
      try {
        const res = await fetch(ownerPhotoUrl, { timeout: 8000 });
        if (res.ok) {
          const imgBuffer = await res.buffer();
          await sock.sendMessage(targetChat, {
            image: imgBuffer,
            caption: profileCaption
          }, { quoted: msg });
          photoSent = true;
        }
      } catch (e) {
        console.error('Image fetch error, falling back to direct url or text:', e.message);
      }

      // Image server එක down නම් text විතරක් යවයි (command එක crash නොවී run වේ)
      if (!photoSent) {
        await sock.sendMessage(targetChat, { text: profileCaption }, { quoted: msg });
      }

      // 4. Ultra-Smooth Typewriter Animation (Crash Proof)
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

      // 5. Clean Structured Contact Card (Zero-Comma Structured format)
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

      // Contact Box එක යැවීම
      await sock.sendMessage(targetChat, {
        contacts: {
          displayName: `${ownerName} ${ownerCrown}`,
          contacts: [{ vcard }]
        }
      }, { quoted: msg });

      // 6. Crown Reaction
      await sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("Owner Command Error:", err);
      return sock.sendMessage(targetChat, { text: `❌ *Execution Interrupted:* ${err.message}` }, { quoted: msg });
    }
  }
};
