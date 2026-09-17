const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'setdp',
  alias: ['changedp', 'setpp'],
  desc: 'Change Bot Profile Picture',
  async run(sock, msg, args, chatJid, reply, { isOwner }) {
    // Owner check: Bot අයිති කෙනාට විතරයි DP මාරු කරන්න දෙන්නේ
    if (!isOwner) {
      return reply("❌ මේ command එක Owner ට විතරයි පාවිච්චි කරන්න පුළුවන්!");
    }

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const target = quoted?.imageMessage || 
                   quoted?.ephemeralMessage?.message?.imageMessage || 
                   quoted?.viewOnceMessage?.message?.imageMessage || 
                   quoted?.viewOnceMessageV2?.message?.imageMessage || 
                   msg.message?.imageMessage;

    if (!target) {
      return reply("📸 DP එකට දාන්න ඕන image එකකට reply කරලා හරි, image එකක් එක්ක caption එකක් විදියට හරි `.setdp` ගහන්න!");
    }

    try {
      await reply("⏳ DP එක update වෙමින් පවතී, පොඩ්ඩක් ඉන්න...");

      // Image එක download කරගැනීම
      const stream = await downloadContentFromMessage(target, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      // Bot JID එක හඳුනාගැනීම
      const botNum = sock.user?.id ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : '';
      const botJid = `${botNum}@s.whatsapp.net`;

      // Profile Picture Update කිරීම
      await sock.updateProfilePicture(botJid, buffer);
      await reply("😎✅ Profile Picture එක සාර්ථකව Update උනා!");

    } catch (err) {
      console.error('setdp Error:', err);
      await reply("❌ DP එක update කරන්න බැරි උනා! Error එකක් ආවා.");
    }
  }
};

