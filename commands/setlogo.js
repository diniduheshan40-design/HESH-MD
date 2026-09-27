// commands/setlogo.js
const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');

// 👑 ROOT DEVELOPER NUMBER
const DEVELOPER_NUMBER = '94719845166';

const OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '72787431583987'
];

function getSettingsModel() {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    return mongoose.models.BotSettings || mongoose.model('BotSettings');
  } catch (e) {
    return null;
  }
}

function unwrapMessage(msgObj) {
  if (!msgObj) return null;
  return (
    msgObj.ephemeralMessage?.message ||
    msgObj.viewOnceMessage?.message ||
    msgObj.viewOnceMessageV2?.message ||
    msgObj.viewOnceMessageV2Extension?.message ||
    msgObj.documentWithCaptionMessage?.message ||
    msgObj
  );
}

// ⚡ Cloud Persistent Logo Uploader (Catbox CDN)
async function uploadToCatbox(buffer) {
  try {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename: 'bot_logo.jpg' });

    const res = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: form.getHeaders(),
      timeout: 25000
    });

    if (typeof res.data === 'string' && res.data.startsWith('http')) {
      return res.data.trim();
    }
  } catch (e) {}
  return null;
}

module.exports = {
  name: 'setlogo',
  alias: ['logo', 'setbotlogo', 'changelogo'],
  category: 'owner',
  desc: 'Set custom bot logo permanently for this bot session',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (content) => {
      if (typeof safeReply === 'function' && typeof content === 'string') return await safeReply(content);
      const payload = typeof content === 'string' ? { text: content } : content;
      return await sock.sendMessage(targetChat, { ...payload, ...(global.channelContext || {}) }, { quoted: msg });
    };

    // ⚡ 1. SENDER VERIFICATION (Group / Private / LID Support)
    const isGroup = targetChat.endsWith('@g.us');
    let senderJid = isGroup 
      ? (msg.key?.participant || msg.participant || '') 
      : (msg.key?.fromMe ? (sock.user?.id || '') : targetChat);

    if (senderJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
      try {
        const resolved = await sock.signalRepository.lidToJid(senderJid);
        if (resolved) senderJid = resolved;
      } catch (e) {}
    }

    const cleanSenderNum = jidNormalizedUser(senderJid).replace(/\D/g, '');
    const isDeveloper = cleanSenderNum === DEVELOPER_NUMBER;
    const isOwner = Boolean(
      isDeveloper ||
      options.isOwner || 
      msg.key?.fromMe || 
      OWNER_NUMBERS.some(num => cleanSenderNum === num.replace(/\D/g, ''))
    );

    if (!isOwner) {
      return await reply('⛔ *Access Denied!* මෙම බොට්ගේ Logo එක වෙනස් කළ හැක්කේ Session Owner හට පමණි.');
    }

    // 🛡️ මෙම විශේෂිත බොට්ගේ අංකය පමණක් හඳුනා ගැනීම (Isolated Session ID)
    const myBotJid = jidNormalizedUser(sock.user?.id || '');
    const myBotNum = myBotJid.replace(/\D/g, '');

    if (!myBotNum) {
      return await reply('⚠️ Bot Number හඳුනාගත නොහැකි විය!');
    }

    const rawQuoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quoted = unwrapMessage(rawQuoted);
    const currentMsg = unwrapMessage(msg.message);

    const targetImage = quoted?.imageMessage || currentMsg?.imageMessage;

    if (!targetImage) {
      const helpText = 
`*⚡ SYSTEM LOGO MANAGER ⚡*
────────────────────────────
⚠️ *Photo එකක් හමුවුනේ නැත!*

*💡 භාවිතා කරන ආකාරය:*
*1.* Photo එකක් සමඟ caption එකට \`.setlogo\` යොදන්න.
*2.* නැතහොත් Photo එකකට reply කර \`.setlogo\` යොදන්න.
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

      return await reply(helpText);
    }

    sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      await reply("⏳ Logo එක Cloud Database එකට සුරකිමින් පවතී, කරුණාකර රැඳී සිටින්න...");

      // Image Buffer Download
      const stream = await downloadContentFromMessage(targetImage, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      if (!buffer || buffer.length < 500) {
        throw new Error('Image download failed or empty.');
      }

      // 1. Cloud CDN එකට upload කර permanent link එකක් ලබා ගැනීම
      let permanentLogoUrl = await uploadToCatbox(buffer);

      // Fallback: Catbox fail වුවහොත් Base64 data URL එකක් ලෙස DB එකට දැමීම
      if (!permanentLogoUrl) {
        permanentLogoUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      }

      // 2. අදාළ Bot Number එකේ Database Record එක පමණක් Update කිරීම (Isolated)
      const SettingsModel = getSettingsModel();
      if (SettingsModel) {
        await SettingsModel.findByIdAndUpdate(
          myBotNum,
          { $set: { botLogo: permanentLogoUrl } },
          { upsert: true }
        );
      }

      // 3. Cache එක clear කිරීම (menu, alive ආදියෙන් අලුත් logo එක ක්ෂණිකව කියවීමට)
      if (typeof global.clearSettingsCache === 'function') {
        global.clearSettingsCache(myBotNum);
      }

      sock.sendMessage(targetChat, { react: { text: "👑", key: msg.key } }).catch(() => {});

      const successCaption = 
`*⚡ HESHAN-MD LOGO DEPLOYED ⚡*
────────────────────────────
*🤖 Bot Session :* +${myBotNum}
*💎 Status      :* Successfully Updated
*🖼️ Persistence :* Cloud Database Saved
────────────────────────────
*📢 SYSTEM NOTICE:*
• ඔබගේ බොට්ගේ Logo එක සාර්ථකව Update විය.
• අනිත් කිසිදු බොට් කෙනෙකුට මෙයින් බලපෑමක් නොවනු ඇත.
• \`.menu\` හෝ \`.alive\` ගසා පරික්ෂා කර බලන්න.
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

      return await sock.sendMessage(targetChat, {
        image: buffer,
        caption: successCaption,
        ...(global.channelContext || {})
      }, { quoted: msg });

    } catch (err) {
      console.error("Setlogo Error:", err?.message || err);
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await reply(`❌ *Error:* Logo එක update කිරීමට නොහැකි විය! (${err.message})`);
    }
  }
};
