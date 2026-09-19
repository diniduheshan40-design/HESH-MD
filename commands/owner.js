// commands/owner.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ⚡ Buffer Cache for Zero-Latency Image Loading
let cachedOwnerPhoto = null;
async function getOwnerPhoto() {
  if (cachedOwnerPhoto) return cachedOwnerPhoto;

  try {
    const localPhotoPath = path.join(process.cwd(), 'owner.jpg');
    if (fs.existsSync(localPhotoPath)) {
      cachedOwnerPhoto = fs.readFileSync(localPhotoPath);
      return cachedOwnerPhoto;
    }
  } catch (e) {}

  try {
    const res = await axios.get('https://files.catbox.moe/0fmhj2.jpeg', {
      responseType: 'arraybuffer',
      timeout: 6000
    });
    if (res.status === 200) {
      cachedOwnerPhoto = Buffer.from(res.data);
      return cachedOwnerPhoto;
    }
  } catch (e) {}

  return null;
}

module.exports = {
  name: 'owner',
  alias: ['creator', 'developer', 'dev', 'heshan'],
  category: 'main',
  desc: 'Official owner profile card with smooth 2-word animation',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : msg.key.remoteJid;

    // Instant Non-blocking reaction
    sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    try {
      const ownerNumber = '94719845166';
      const ownerName = '𝐃𝐈𝐍𝐈𝐃𝐔 𝐇𝐄𝐒𝐇𝐀𝐍';
      const ownerCrown = '🤴';

      // ⚡ වචන දෙකෙන් කෙලින්ම වැටෙන සුපිරි Fast Animation එක
      // 1. පළමු වචනය (DINIDU)
      const animMsg = await sock.sendMessage(targetChat, { 
        text: `*👑 ARCHITECT :* 𝐃𝐈𝐍𝐈𝐃𝐔 ▎` 
      }, { quoted: msg });

      if (animMsg?.key) {
        await sleep(500);
        // 2. දෙවෙනි වචනය (HESHAN) එක්ක Crown එක
        await sock.sendMessage(targetChat, { 
          text: `*👑 ARCHITECT :* 𝐃𝐈𝐍𝐈𝐃𝐔 𝐇𝐄𝐒𝐇𝐀𝐍 ${ownerCrown}`, 
          edit: animMsg.key 
        }).catch(() => {});
      }

      await sleep(300);

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

      const imgPayload = await getOwnerPhoto();

      // Profile Card Photo එක යැවීම
      if (imgPayload) {
        await sock.sendMessage(targetChat, {
          image: imgPayload,
          caption: profileCaption
        }, { quoted: msg });
      } else {
        await sock.sendMessage(targetChat, { text: profileCaption }, { quoted: msg });
      }

      // Structured Contact VCard එක
      const vcard = 'BEGIN:VCARD\n'
        + 'VERSION:3.0\n'
        + `FN:${ownerName} ${ownerCrown}\n`
        + `N:${ownerName};;;;${ownerCrown}\n`
        + 'ORG:HESHAN-MD CORE FOUNDATION;\n'
        + 'TITLE:Lead Systems Architect;\n'
        + `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n`
        + 'NOTE:Official Founder & Bot Creator\n'
        + 'END:VCARD';

      // Contact Card එක යැවීම
      await sock.sendMessage(targetChat, {
        contacts: {
          displayName: `${ownerName} ${ownerCrown}`,
          contacts: [{ vcard }]
        }
      }, { quoted: msg });

      // Final signature reaction
      sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("Owner Command Error:", err?.message || err);
      sock.sendMessage(targetChat, { text: `❌ *Error:* ${err.message}` }, { quoted: msg }).catch(() => {});
    }
  }
};

