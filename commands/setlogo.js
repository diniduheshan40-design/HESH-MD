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

module.exports = {
  name: 'setlogo',
  alias: ['logo', 'setbotlogo'],
  category: 'owner',
  desc: 'Set custom bot logo image permanently',

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

      // Process වෙන බව පෙන්වීමට reaction එකක් දමයි
      await sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

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
        await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return sock.sendMessage(targetChat, { text: '❌ Image එක download කරගැනීමට නොහැකි විය. නැවත උත්සාහ කරන්න.' }, { quoted: msg });
      }

      // 1. Local copy එකක් Save කිරීම
      const botLogoPath = path.join(process.cwd(), `logo_${myBotNum}.jpg`);
      fs.writeFileSync(botLogoPath, buffer);

      // 2. Database එකට local file path එක save කිරීම
      await SettingsModel.findByIdAndUpdate(
        myBotNum,
        { $set: { botLogo: botLogoPath } },
        { upsert: true, new: true }
      );

      // Cache flush කිරීම
      if (global.clearSettingsCache) global.clearSettingsCache(myBotNum);

      // සාර්ථක වූ බව දැක්වීමට reaction මාරු කිරීම
      await sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});

      const successCaption = `*⚡ HESHAN-MD LOGO DEPLOYED ⚡*
────────────────────────────
*🤖 Session :* +${myBotNum}
*💎 Status  :* Successfully Updated
*🖼️ File    :* Saved to System
────────────────────────────
*📢 SYSTEM NOTICE:*
• Logo එක සාර්ථකව update විය.
• \`.settings\` ගසා පරීක්ෂා කර බලන්න.
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

      return await sock.sendMessage(targetChat, {
        image: buffer,
        caption: successCaption
      }, { quoted: msg });

    } catch (err) {
      console.error("Setlogo Error:", err);
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return sock.sendMessage(targetChat, { text: `❌ *Error:* ${err.message}` }, { quoted: msg });
    }
  }
};

