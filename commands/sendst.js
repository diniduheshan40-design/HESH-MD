const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'sendst',
  alias: ['status', 'upstatus'],
  desc: 'Send WhatsApp Status (Text / Photo / Video)',
  async run(sock, msg, args, chatJid, reply, { isOwner }) {
    if (!isOwner) {
      return reply("❌ මේ command එක Owner ට විතරයි පාවිච්චි කරන්න පුළුවන්!");
    }

    const statusJid = 'status@broadcast';
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    const isImage = quoted?.imageMessage || 
                    quoted?.ephemeralMessage?.message?.imageMessage || 
                    quoted?.viewOnceMessage?.message?.imageMessage || 
                    quoted?.viewOnceMessageV2?.message?.imageMessage || 
                    msg.message?.imageMessage;

    const isVideo = quoted?.videoMessage || 
                    quoted?.ephemeralMessage?.message?.videoMessage || 
                    quoted?.viewOnceMessage?.message?.videoMessage || 
                    quoted?.viewOnceMessageV2?.message?.videoMessage || 
                    msg.message?.videoMessage;

    const caption = args.join(' ') || '';

    try {
      // 1. Image Status
      if (isImage) {
        await reply("⏳ Photo Status එක upload වෙනවා...");

        const stream = await downloadContentFromMessage(isImage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }

        await sock.sendMessage(statusJid, {
          image: buffer,
          caption: caption
        });

        return reply("📸🔥 Photo Status එක සාර්ථකව දැම්මා!");
      }

      // 2. Video Status
      if (isVideo) {
        await reply("⏳ Video Status එක upload වෙනවා...");

        const stream = await downloadContentFromMessage(isVideo, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }

        await sock.sendMessage(statusJid, {
          video: buffer,
          caption: caption
        });

        return reply("🎥🔥 Video Status එක සාර්ථකව දැම්මා!");
      }

      // 3. Text Status
      const textToPost = args.join(' ');
      if (!textToPost) {
        return reply("📝 Text status එකක් දානවා නම් text එක ලියන්න (උදා: `.sendst Good morning`), නැත්නම් photo/video එකකට reply කරලා `.sendst` ගහන්න!");
      }

      await reply("⏳ Text Status එක upload වෙනවා...");
      await sock.sendMessage(statusJid, {
        text: textToPost,
        backgroundColor: '#790519', // Red-black theme එකට ගැලපෙන background එකක්
        font: 1
      });

      return reply("📝✅ Text Status එක සාර්ථකව දැම්මා!");

    } catch (err) {
      console.error('sendst Error:', err);
      await reply("❌ Status එක දාන්න බැරි උනා! Error එකක් ආවා.");
    }
  }
};

