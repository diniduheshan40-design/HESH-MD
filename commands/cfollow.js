module.exports = {
  name: 'cfollow',
  alias: ['chfollow', 'channelfollow'],
  category: 'channel',
  desc: 'Follow any WhatsApp Channel',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    const reply = async (text) => (typeof safeReply === 'function' ? safeReply(text) : sock.sendMessage(targetChat, { text }, { quoted: msg }));

    const input = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();
    const match = input.match(/(?:whatsapp\.com\/channel\/|^)([a-zA-Z0-9]{20,28})/i);

    if (!match) return await reply('💡 *භාවිතය:* `.cfollow <channel_link>`');

    try {
      const inviteCode = match[1];
      let channelJid = null;

      if (typeof sock.newsletterMetadata === 'function') {
        const meta = await sock.newsletterMetadata('invite', inviteCode).catch(() => null);
        if (meta?.id) channelJid = meta.id.includes('@newsletter') ? meta.id : `${meta.id}@newsletter`;
      }

      if (!channelJid) return await reply('❌ Channel එක හඳුනාගත නොහැකි විය.');

      if (typeof sock.newsletterFollow === 'function') {
        await sock.newsletterFollow(channelJid);
        await reply('✅ Channel එක සාර්ථකව Follow කරන ලදී!');
      } else {
        await reply('❌ Baileys function missing: newsletterFollow');
      }
    } catch (err) {
      await reply(`❌ Error: ${err.message || 'Follow කිරීම අසාර්ථකයි'}`);
    }
  }
};
