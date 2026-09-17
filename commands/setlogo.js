// commands/setlogo.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Database Model
const SettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  botLogo: { type: String, default: 'https://files.catbox.moe/a58add.jpeg' }
}, { strict: false });

const SettingsModel = mongoose.models.BotSettings || mongoose.model('BotSettings', SettingsSchema);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  name: 'setlogo',
  alias: ['logo', 'setbotlogo'],
  category: 'owner',
  desc: 'Set custom bot logo image permanently with animated loading',

  async execute(sock, msg, args, chatJid, safeReply, { isOwner }) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : msg.key.remoteJid;

    // Owner verification check
    if (isOwner !== undefined && !isOwner) {
      return sock.sendMessage(targetChat, { text: '⛔ *Access Denied!* Only Owner can modify the system logo.' }, { quoted: msg });
    }

    try {
      const myBotNum = (sock.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      if (!myBotNum) {
        return sock.sendMessage(targetChat, { text: '⚠️ Bot Number හඳුනාගත නොහැකි විය.' }, { quoted: msg });
      }

      // Initial Reaction
      sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      // Photo එක direct එවපු එකක්ද නැත්නම් Quoted (Reply) කරපු එකක්ද කියා හඳුනාගැනීම
      const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = quotedContext?.quotedMessage;
      let targetMsg = null;

      if (msg.message?.imageMessage) {
        targetMsg = msg;
      } else if (quotedMsg?.imageMessage) {
        targetMsg = {
          key: {
            remoteJid: targetChat,
            id: quotedContext?.stanzaId,
            participant: quotedContext?.participant
          },
          message: quotedMsg
        };
      }

      if (!targetMsg) {
        return sock.sendMessage(targetChat, { 
          text: `╭── ❖ *SYSTEM LOGO MANAGER* ❖ ──╮
│
│ ⚠️ *Photo එකක් හමුවුනේ නැත!*
│
│ 💡 *භාවිතා කරන ආකාරය:*
│  1. Photo එකක් Caption එක ලෙස \`.setlogo\` යොදා එවන්න.
│  2. නැතහොත් Photo එකකට Reply කර \`.setlogo\` යොදන්න.
│
╰─────────────────────────────╯` 
        }, { quoted: msg });
      }

      // ─── 🚀 NEXT-GEN CYBERPUNK LIVE LOADING ANIMATION ───
      const animFrames = [
        "╭── ⚡ *HESHAN-MD CORE INITIALIZING* ⚡ ──╮\n│\n│ 🛰️ *Buffer Extraction Started...*\n│ ▓▒▒▒▒▒▒▒▒▒ 12%\n│ 💠 Status: Fetching Binary Stream\n│\n╰──────────────────────────────────╯",
        "╭── ⚡ *NEURAL MEDIA PARSING* ⚡ ──╮\n│\n│ 🧬 *Encoding Quantum Pixels...*\n│ ▓▓▓▒▒▒▒▒▒▒ 38%\n│ ⚡ Engine: Syncing Resolution Data\n│\n╰──────────────────────────────────╯",
        "╭── ⚡ *DATABASE CLOUD SYNC* ⚡ ──╮\n│\n│ 🍃 *Writing to MongoDB Vault...*\n│ ▓▓▓▓▓▓▒▒▒▒ 65%\n│ 🔒 Integrity: Persistent Key Locked\n│\n╰──────────────────────────────────╯",
        "╭── ⚡ *CACHE INVALIDATION* ⚡ ──╮\n│\n│ 🧹 *Flushing Dynamic Memory Nodes...*\n│ ▓▓▓▓▓▓▓▓▒▒ 89%\n│ ✨ Status: Rebuilding Render Layers\n│\n╰──────────────────────────────────╯",
        "╭── ⚡ *FINALIZING DEPLOYMENT* ⚡ ──╮\n│\n│ 🌟 *Injecting Graphic Configuration...*\n│ ▓▓▓▓▓▓▓▓▓▓ 100%\n│ 💎 Result: System Ready\n│\n╰──────────────────────────────────╯"
      ];

      // Send the initial animated loader frame
      let activeLoader = await sock.sendMessage(targetChat, { text: animFrames[0] }, { quoted: msg });

      // Frame 1 -> Frame 2
      await sleep(220);
      await sock.sendMessage(targetChat, { text: animFrames[1], edit: activeLoader.key }).catch(() => {});

      // Image එක Download කර Buffer එකක් ලබා ගැනීම
      const buffer = await downloadMediaMessage(
        targetMsg,
        'buffer',
        {},
        { 
          logger: console,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer || buffer.length === 0) {
        return sock.sendMessage(targetChat, { 
          text: '❌ Media stream download failed! කරුණාකර නැවත උත්සාහ කරන්න.', 
          edit: activeLoader.key 
        }).catch(async () => {
          await sock.sendMessage(targetChat, { text: '❌ Media stream download failed!' }, { quoted: msg });
        });
      }

      // Frame 2 -> Frame 3
      await sleep(200);
      await sock.sendMessage(targetChat, { text: animFrames[2], edit: activeLoader.key }).catch(() => {});

      // 1. Local storage එකට Save කිරීම (Current session එකේ ක්ෂණික access සඳහා)
      const botLogoPath = path.join(process.cwd(), `logo_${myBotNum}.jpg`);
      fs.writeFileSync(botLogoPath, buffer);

      // 2. Restart වුණත් නොමැකී තියෙන්න Buffer එක Base64 Data URI එකක් විදිහට MongoDB එකට Save කිරීම
      const base64DataUri = `data:image/jpeg;base64,${buffer.toString('base64')}`;

      await SettingsModel.findByIdAndUpdate(
        myBotNum,
        { $set: { botLogo: base64DataUri } },
        { upsert: true, new: true }
      );

      // Frame 3 -> Frame 4
      await sleep(200);
      await sock.sendMessage(targetChat, { text: animFrames[3], edit: activeLoader.key }).catch(() => {});

      // Cache Eviction
      if (global.clearSettingsCache) global.clearSettingsCache(myBotNum);

      // Frame 4 -> Frame 5 (100%)
      await sleep(200);
      await sock.sendMessage(targetChat, { text: animFrames[4], edit: activeLoader.key }).catch(() => {});
      await sleep(250);

      // Final Success Reaction
      sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});

      // Loader එක delete කර preview එක සමඟ success banner එක යැවීම
      await sock.sendMessage(targetChat, { delete: activeLoader.key }).catch(() => {});

      const successCaption = `╭─── ⚡ *HESHAN-MD LOGO DEPLOYED* ⚡ ───╮
│
├ 🤖 *Instance  :* +${myBotNum}
├ 💎 *Status    :* Permanent Sync Completed
├ 🛡️ *Storage   :* MongoDB Cloud Database 🍃
├ ⚙️ *Security  :* Auto-Reload Protected
│
├─◈ *SYSTEM REPORT:*
│  ✦ Container restart වුවද වෙනස් නොවේ!
│  ✦ Session Cache එක සාර්ථකව Flush කරන ලදී.
│
╰──────────────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

      return await sock.sendMessage(targetChat, {
        image: buffer,
        caption: successCaption
      }, { quoted: msg });

    } catch (err) {
      console.error("Setlogo Error:", err);
      return sock.sendMessage(targetChat, { 
        text: `❌ *Execution Interrupted:* ${err.message}` 
      }, { quoted: msg });
    }
  }
};
