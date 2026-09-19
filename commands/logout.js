// commands/logout.js
module.exports = {
  name: 'logout',
  alias: ['delsession', 'stopbot'],
  category: 'owner',
  desc: 'Permanently remove this session from database and system',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const isOwner = options.isOwner || msg.key.fromMe;
    const targetChat = chatJid || msg.key.remoteJid;

    if (!isOwner) {
      return await sock.sendMessage(targetChat, { 
        text: '⛔ *Access Denied!* Only the session owner can delete this bot.' 
      }, { quoted: msg });
    }

    const botNumber = (sock.user?.id || '').split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    if (!botNumber) return;

    await sock.sendMessage(targetChat, {
      text: `⚠️ *SESSION PURGE INITIATED*\n\n+${botNumber} බොට්ගේ සියලුම Data පද්ධතියෙන් ස්ථිරවම මකා දමයි. තත්පර 3කින් Session එක Disconnect වේ.`
    }, { quoted: msg });

    setTimeout(async () => {
      try {
        await sock.logout(); // WhatsApp session එක un-link කරයි (මෙය ස්වයංක්‍රීයව handleConnectionClose එක trigger කරයි)
      } catch (e) {
        try { sock.ws?.close(); } catch(err) {}
      }
    }, 3000);
  }
};

