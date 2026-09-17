// commands/owner.js

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

      // 2. High-Tech Glassmorphic Identity Poster
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

      await sock.sendMessage(targetChat, {
        image: { url: ownerPhotoUrl },
        caption: profileCaption
      }, { quoted: msg });

      // 3. Ultra-Smooth Typewriter Animation (Rate-limit safe & No comma artifact)
      // Array.from() මගින් bold unicode glyphs කැඩී යාම වළක්වයි
      const chars = Array.from(ownerName);
      let animatedText = chars[0];

      let animMsg = await sock.sendMessage(targetChat, { 
        text: `*👑 ARCHITECT :* ${animatedText} ▎` 
      }, { quoted: msg });

      // අකුරෙන් අකුර edit වන smooth transition එක
      for (let i = 1; i < chars.length; i++) {
        await sleep(300);
        animatedText += chars[i];
        const cursor = (i === chars.length - 1) ? ` ${ownerCrown}` : ' ▎';

        await sock.sendMessage(targetChat, { 
          text: `*👑 ARCHITECT :* ${animatedText}${cursor}`, 
          edit: animMsg.key 
        }).catch(() => {});
      }

      // 4. Clean Structured Contact Card (Zero Comma Display)
      // N: සහ FN: දෙකම semicolons මගින් split කර Single Full Name එකක් ලෙස සකසා ඇත
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

      // 5. Contact Box එක යැවීම
      await sock.sendMessage(targetChat, {
        contacts: {
          displayName: `${ownerName} ${ownerCrown}`,
          contacts: [{ vcard }]
        }
      }, { quoted: msg });

      // 6. Signature Crown Reaction
      await sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("Owner Command Error:", err);
      return sock.sendMessage(targetChat, { text: `❌ *Execution Interrupted:* ${err.message}` }, { quoted: msg });
    }
  }
};

