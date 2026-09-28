module.exports = {
  name: 'creact',
  alias: ['channelreact', 'chr'],
  category: 'channel',
  desc: 'React to a WhatsApp Channel post',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text }, { quoted: msg });
    };

    const rawInput = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();
    if (!rawInput.includes(',')) {
      return await reply('💡 *භාවිතය:* `.creact <channel_post_link>,<emojis>`\n\n📌 *උදා:* `.creact https://whatsapp.com/channel/0029VbC9VEUKQuJCVtJERV1j/515,🔥❤️`');
    }

    const firstComma = rawInput.indexOf(',');
    const postLink = rawInput.substring(0, firstComma).trim();
    const emojis = rawInput.substring(firstComma + 1).trim();

    const match = postLink.match(/(?:whatsapp\.com\/channel\/|^)([a-zA-Z0-9]{20,28})\/(\d+)/i);
    if (!match) {
      return await reply('❌ වලංගු Channel Post Link එකක් ඇතුළත් කරන්න!\n(උදා: https://whatsapp.com/channel/xxx/123)');
    }

    const [, inviteCode, serverId] = match;

    try {
      let channelJid = null;
      if (typeof sock.newsletterMetadata === 'function') {
        const meta = await sock.newsletterMetadata('invite', inviteCode).catch(() => null);
        if (meta?.id) channelJid = meta.id.includes('@newsletter') ? meta.id : `${meta.id}@newsletter`;
      }

      if (!channelJid && typeof sock.newsletterSubscribed === 'function') {
        const subs = await sock.newsletterSubscribed().catch(() => []);
        const found = Array.isArray(subs) ? subs.find(c => c?.invite === inviteCode) : null;
        if (found?.id) channelJid = found.id.includes('@newsletter') ? found.id : `${found.id}@newsletter`;
      }

      if (!channelJid) {
        return await reply('❌ Channel එක හඳුනාගත නොහැකි විය. Bot Channel එකේ Admin ද බලන්න.');
      }

      const emojiList = Array.from(emojis.replace(/\s+/g, ''));
      for (const em of emojiList) {
        if (typeof sock.newsletterReactMessage === 'function') {
          await sock.newsletterReactMessage(channelJid, serverId, em).catch(() => {});
        }
      }

      await reply('✅ Channel Post එකට සාර්ථකව React කරන ලදී!');
    } catch (err) {
      await reply(`❌ Error: ${err.message || 'React කිරීමට නොහැකි විය'}`);
    }
  }
};
