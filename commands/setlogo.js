// commands/setlogo.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const SettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  botLogo: { type: String, default: './logo.jpg' }
}, { strict: false });

const SettingsModel = mongoose.models.BotSettings || mongoose.model('BotSettings', SettingsSchema);

module.exports = {
  name: 'setlogo',
  alias: ['logo', 'setbotlogo'],
  category: 'owner',
  desc: 'Set custom bot logo image permanently',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : msg.key.remoteJid;

    const isOwner = options.isOwner || msg.key.fromMe;
    if (!isOwner) {
      return sock.sendMessage(targetChat, { text: '⛔ *Access Denied!* Only Owner can modify the system logo.' }, { quoted: msg });
    }

    try {
      const myBotNum = (sock.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      if (!myBotNum) {
        return sock.sendMessage(targetChat, { text: '⚠️ Bot Number හඳුනාගත නොහැකි විය.' }, { quoted: msg });
      }

      const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = quotedContext?.quotedMessage;
      const targetImage = msg.message?.imageMessage || quotedMsg?.imageMessage;

      if (!targetImage) {
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

      // Fast Non-blocking reaction
      sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // ⚡ Low-Memory Stream Extraction
      const stream = await downloadContentFromMessage(targetImage, 'image');
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      if (!buffer || buffer.length === 0) {
        sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return sock.sendMessage(targetChat, { text: '❌ Image එක download කරගැනීමට නොහැකි විය. නැවත උත්සාහ කරන්න.' }, { quoted: msg });
      }

      // Root logo and session-specific logo write (Non-blocking)
      const primaryLogoPath = path.join(process.cwd(), 'logo.jpg');
      const sessionLogoPath = path.join(process.cwd(), `logo_${myBotNum}.jpg`);

      await Promise.allSettled([
        fs.promises.writeFile(primaryLogoPath, buffer),
        fs.promises.writeFile(sessionLogoPath, buffer)
      ]);

      // Database Update
      await SettingsModel.findByIdAndUpdate(
        myBotNum,
        { $set: { botLogo: primaryLogoPath } },
        { upsert: true }
      );

      // Invalidate all runtime memory caches
      if (typeof global.clearSettingsCache === 'function') {
        global.clearSettingsCache(myBotNum);
      }

      sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});

      const successCaption = `*⚡ HESHAN-MD LOGO DEPLOYED ⚡*
────────────────────────────
*🤖 Session :* +${myBotNum}
*💎 Status  :* Successfully Updated
*🖼️ File    :* Saved to System
────────────────────────────
*📢 SYSTEM NOTICE:*
• Logo එක සාර්ථකව update විය.
• \`.menu\` හෝ \`.settings\` ගසා පරීක්ෂා කර බලන්න.
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

      return await sock.sendMessage(targetChat, {
        image: buffer,
        caption: successCaption
      }, { quoted: msg });

    } catch (err) {
      console.error("Setlogo Error:", err?.message || err);
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return sock.sendMessage(targetChat, { text: `❌ *Error:* ${err.message}` }, { quoted: msg });
    }
  }
};

