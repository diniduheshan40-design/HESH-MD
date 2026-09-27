// commands/sendst.js
const { downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');

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

module.exports = {
  name: 'sendst',
  alias: ['status', 'upstatus', 'poststatus'],
  category: 'owner',
  desc: 'Send WhatsApp Status (Text / Photo / Video / Audio)',

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
      return await reply("❌ මෙම Command එක භාවිත කළ හැක්කේ Bot Owner හට පමණි!");
    }

    const statusJid = 'status@broadcast';
    const rawQuoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quoted = unwrapMessage(rawQuoted);
    const currentMsg = unwrapMessage(msg.message);

    const isImage = quoted?.imageMessage || currentMsg?.imageMessage;
    const isVideo = quoted?.videoMessage || currentMsg?.videoMessage;
    const isAudio = quoted?.audioMessage || currentMsg?.audioMessage;

    const caption = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      // 1. Photo Status
      if (isImage) {
        await reply("⏳ Photo Status එක upload වෙමින් පවතී...");

        const stream = await downloadContentFromMessage(isImage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(statusJid, {
          image: buffer,
          caption: caption
        });

        sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return await reply("📸🔥 Photo Status එක සාර්ථකව පළ කරන ලදි!");
      }

      // 2. Video Status
      if (isVideo) {
        await reply("⏳ Video Status එක upload වෙමින් පවතී...");

        const stream = await downloadContentFromMessage(isVideo, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(statusJid, {
          video: buffer,
          caption: caption
        });

        sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return await reply("🎥🔥 Video Status එක සාර්ථකව පළ කරන ලදි!");
      }

      // 3. Audio / Voice Status
      if (isAudio) {
        await reply("⏳ Voice Status එක upload වෙමින් පවතී...");

        const stream = await downloadContentFromMessage(isAudio, 'audio');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        await sock.sendMessage(statusJid, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: true
        });

        sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return await reply("🎙️🔥 Audio Status එක සාර්ථකව පළ කරන ලදි!");
      }

      // 4. Text Status
      if (!caption) {
        sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await reply("📝 Text status එකක් දැමීමට text එකක් ලියන්න (උදා: `.sendst Good Morning`), නැතහොත් Photo/Video එකකට reply කර `.sendst` යොදන්න!");
      }

      await reply("⏳ Text Status එක upload වෙමින් පවතී...");
      await sock.sendMessage(statusJid, {
        text: caption,
        backgroundColor: '#790519',
        font: 1
      });

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
      return await reply("📝✅ Text Status එක සාර්ථකව පළ කරන ලදි!");

    } catch (err) {
      console.error('sendst Error:', err?.message || err);
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await reply(`❌ Status එක පළ කිරීමට නොහැකි විය! (${err.message || 'Unknown error'})`);
    }
  }
};
