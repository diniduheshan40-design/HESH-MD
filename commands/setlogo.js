// commands/setlogo.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Database Model
const SettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  botLogo: { type: String, default: 'https://files.catbox.moe/a58add.jpeg' }
}, { strict: false });

const SettingsModel = mongoose.models.BotSettings || mongoose.model('BotSettings', SettingsSchema);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Catbox CDN එකට upload කර ස්ථිර Link එකක් ලබාගැනීමේ helper function එක
async function uploadToCatbox(buffer) {
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename: 'logo.jpg' });

    const response = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: form
    });

    const url = await response.text();
    if (url && url.startsWith('http')) {
      return url.trim();
    }
  } catch (err) {
    console.error('Catbox upload error:', err.message);
  }
  return null;
}

module.exports = {
  name: 'setlogo',
  alias: ['logo', 'setbotlogo'],
  category: 'owner',
  desc: 'Set custom bot logo permanently without database freeze',

  async execute(sock, msg, args, chatJid, safeReply, { isOwner }) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : msg.key.remoteJid;

    if (isOwner !== undefined && !isOwner) {
      return sock.sendMessage(targetChat, { text: '⛔ *Access Denied!* Only Owner can modify the system logo.' }, { quoted: msg });
    }

    try {
      const myBotNum = (sock.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      if (!myBotNum) {
        return sock.sendMessage(targetChat, { text: '⚠️ Bot Number හඳුනාගත නොහැකි විය.' }, { quoted: msg });
      }

      sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

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

      // Step 1: 30% Loader යැවීම
      const initialText = `*⚡ HESHAN-MD LOGO SYNC ⚡*
────────────────────────────
🔄 [■■■░░░░░░░] 30%
✦ Status: Downloading image stream...`;

      let activeLoader = await sock.sendMessage(targetChat, { text: initialText }, { quoted: msg });

      // Image එක download කිරීම
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
          text: '❌ Image download fail විය! කරුණාකර නැවත උත්සාහ කරන්න.', 
          edit: activeLoader.key 
        }).catch(async () => {
          await sock.sendMessage(targetChat, { text: '❌ Image download fail විය!' }, { quoted: msg });
        });
      }

      // Step 2: 70% Loader Update
      await sock.sendMessage(targetChat, { 
        text: `*⚡ HESHAN-MD LOGO SYNC ⚡*
────────────────────────────
🔄 [■■■■■■■░░░] 70%
✦ Status: Uploading to Cloud Vault...`, 
        edit: activeLoader.key 
      }).catch(() => {});

      // 1. Local copy save කර තැබීම
      const botLogoPath = path.join(process.cwd(), `logo_${myBotNum}.jpg`);
      fs.writeFileSync(botLogoPath, buffer);

      // 2. Cloud එකට upload කර direct URL ලබාගැනීම (Fail වුවහොත් local file path එක යොදයි)
      let finalLogoUrl = await uploadToCatbox(buffer);
      if (!finalLogoUrl) {
        finalLogoUrl = botLogoPath;
      }

      // 3. Database එකට සැහැල්ලු URL එකක් ලෙස Save කිරීම (මිලි තත්පර 10කින් save වේ)
      await SettingsModel.findByIdAndUpdate(
        myBotNum,
        { $set: { botLogo: finalLogoUrl } },
        { upsert: true, new: true }
      );

      // Cache flush කිරීම
      if (global.clearSettingsCache) global.clearSettingsCache(myBotNum);

      // Step 3: 100% Completed Loader Update
      await sock.sendMessage(targetChat, { 
        text: `*⚡ HESHAN-MD LOGO SYNC ⚡*
────────────────────────────
✅ [■■■■■■■■■■] 100%
✦ Status: Successfully Deployed!`, 
        edit: activeLoader.key 
      }).catch(() => {});

      await sleep(600);

      // Success Reaction
      sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});

      // Loader එක delete කිරීම
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

