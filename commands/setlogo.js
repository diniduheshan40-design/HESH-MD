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
  desc: 'Set custom bot logo image permanently with clean layout',

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
        const helpText = `*⚡ SYSTEM LOGO MANAGER ⚡*
────────────────────────────
⚠️ *Photo එකක් හමුවුනේ නැත!*

*💡 භාවිතා කරන ආකාරය:*
*1.* Photo එකක් සමඟ caption එකට \`.setlogo\` යොදන්න.
*2.* නැතහොත් Photo එකකට reply කර \`.setlogo\` යොදන්න.
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

        return sock.sendMessage(targetChat, { text: helpText }, { quoted: msg });
      }

      // ─── 🌟 ULTRA-CLEAN EDIT ANIMATION (No Broken Lines) ───
      const initialText = `*⚡ HESHAN-MD LOGO SYNC ⚡*
────────────────────────────
🔄 [░░░░░░░░░░] 0%
✦ Status: Initializing stream...`;

      let activeLoader = await sock.sendMessage(targetChat, { text: initialText }, { quoted: msg });

      // Frame 1
      await sleep(400);
      await sock.sendMessage(targetChat, { 
        text: `*⚡ HESHAN-MD LOGO SYNC ⚡*
────────────────────────────
🔄 [■■■░░░░░░░] 30%
✦ Status: Downloading media stream...`, 
        edit: activeLoader.key 
      }).catch(() => {});

      // Media download කිරීම
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
          text: '❌ Image stream download fail විය! නැවත උත්සාහ කරන්න.', 
          edit: activeLoader.key 
        }).catch(async () => {
          await sock.sendMessage(targetChat, { text: '❌ Image stream download fail විය!' }, { quoted: msg });
        });
      }

      // Frame 2
      await sleep(400);
      await sock.sendMessage(targetChat, { 
        text: `*⚡ HESHAN-MD LOGO SYNC ⚡*
────────────────────────────
🔄 [■■■■■■░░░░] 65%
✦ Status: Syncing with MongoDB vault...`, 
        edit: activeLoader.key 
      }).catch(() => {});

      // 1. Local copy එකක් හැදීම
      const botLogoPath = path.join(process.cwd(), `logo_${myBotNum}.jpg`);
      fs.writeFileSync(botLogoPath, buffer);

      // 2. Base64 Data URI එකක් විදිහට MongoDB එකට සදාකාලිකව Save කිරීම
      const base64DataUri = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      await SettingsModel.findByIdAndUpdate(
        myBotNum,
        { $set: { botLogo: base64DataUri } },
        { upsert: true, new: true }
      );

      // Cache Eviction
      if (global.clearSettingsCache) global.clearSettingsCache(myBotNum);

      // Frame 3 (Complete)
      await sleep(400);
      await sock.sendMessage(targetChat, { 
        text: `*⚡ HESHAN-MD LOGO SYNC ⚡*
────────────────────────────
✅ [■■■■■■■■■■] 100%
✦ Status: Successfully Deployed!`, 
        edit: activeLoader.key 
      }).catch(() => {});

      await sleep(350);

      // Final Reaction
      sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});

      // Loader එක delete කර preview එක සමඟ clean caption එක යැවීම
      await sock.sendMessage(targetChat, { delete: activeLoader.key }).catch(() => {});

      const successCaption = `*⚡ HESHAN-MD LOGO DEPLOYED ⚡*
────────────────────────────
*🤖 Session :* +${myBotNum}
*💎 Status  :* Permanent Sync Completed
*🍃 Storage :* MongoDB Cloud Database
*🔒 Security:* Auto-Reload Protected
────────────────────────────
*📢 SYSTEM NOTICE:*
• Server restart වුවද වෙනස් නොවේ.
• Cache storage එක සාර්ථකව reload විය.
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

      return await sock.sendMessage(targetChat, {
        image: buffer,
        caption: successCaption
      }, { quoted: msg });

    } catch (err) {
      console.error("Setlogo Error:", err);
      return sock.sendMessage(targetChat, { 
        text: `❌ *Execution Error:* ${err.message}` 
      }, { quoted: msg });
    }
  }
};

