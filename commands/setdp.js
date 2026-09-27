// commands/setdp.js
const { downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 👑 ROOT DEVELOPER NUMBER
const DEVELOPER_NUMBER = '94719845166';

const OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '72787431583987'
];

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

// WhatsApp DP සඳහා Square (1:1) JPEG Image එකක් බවට පත් කිරීම
function processProfileImage(inputBuffer) {
  return new Promise((resolve, reject) => {
    const tempIn = path.join(os.tmpdir(), `dp_in_${Date.now()}.jpg`);
    const tempOut = path.join(os.tmpdir(), `dp_out_${Date.now()}.jpg`);

    fs.writeFileSync(tempIn, inputBuffer);

    // 640x640 Center crop square image for WhatsApp DP
    const args = [
      '-y', '-i', tempIn,
      '-vf', "crop='min(iw,ih)':'min(iw,ih)',scale=640:640",
      tempOut
    ];

    const proc = spawn(ffmpegPath, args);

    proc.on('close', (code) => {
      try { if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn); } catch (e) {}
      if (code === 0 && fs.existsSync(tempOut)) {
        const outBuf = fs.readFileSync(tempOut);
        try { if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut); } catch (e) {}
        resolve(outBuf);
      } else {
        try { if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut); } catch (e) {}
        resolve(inputBuffer); // FFmpeg fail වුවහොත් original buffer එකම භාවිත කරයි
      }
    });

    proc.on('error', () => {
      try { if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn); } catch (e) {}
      resolve(inputBuffer);
    });
  });
}

module.exports = {
  name: 'setdp',
  alias: ['changedp', 'setpp', 'botdp'],
  category: 'owner',
  desc: 'Change Bot Profile Picture (Self Only)',

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
      return await reply("❌ මේ command එක Owner ට විතරයි පාවිච්චි කරන්න පුළුවන්!");
    }

    const rawQuoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quoted = unwrapMessage(rawQuoted);
    const currentMsg = unwrapMessage(msg.message);

    const targetImg = quoted?.imageMessage || currentMsg?.imageMessage;

    if (!targetImg) {
      return await reply("📸 DP එකට දැමීමට image එකකට reply කර හෝ image එකක් සමඟ caption එක ලෙස `.setdp` යොදන්න!");
    }

    sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      await reply("⏳ DP එක update වෙමින් පවතී, කරුණාකර රැඳී සිටින්න...");

      // Image Stream Download
      const stream = await downloadContentFromMessage(targetImg, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

      // 🛡️ Strict Target: මේ Message එක ලැබුණු socket එකේ User ID (තමන්ගේ බොට්ගේ අංකය) පමණක් තෝරා ගැනීම
      const myBotJid = jidNormalizedUser(sock.user?.id || '');
      if (!myBotJid) {
        throw new Error('Bot JID හඳුනාගත නොහැකි විය!');
      }

      // WhatsApp DP එක සඳහා Square crop කිරීම
      const finalBuffer = await processProfileImage(buffer);

      // තමන්ගේ Profile Picture එක පමණක් Update කිරීම
      await sock.updateProfilePicture(myBotJid, finalBuffer);

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
      return await reply("😎✅ ඔබගේ Bot Profile Picture එක සාර්ථකව Update විය!");

    } catch (err) {
      console.error('setdp Error:', err?.message || err);
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await reply(`❌ DP එක update කිරීමට නොහැකි විය! (${err.message || 'Unknown error'})`);
    }
  }
};
