// commands/creact.js
module.exports = {
  name: 'creact',
  alias: ['channelreact', 'chr', 'allreact'],
  category: 'channel',
  desc: 'React to a WhatsApp Channel post from all active connected bots',

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

    // Link එකෙන් Invite Code එක සහ Server Post ID එක ලබාගැනීම
    const match = postLink.match(/(?:whatsapp\.com\/channel\/|^)([a-zA-Z0-9]{20,28})\/(\d+)/i);
    if (!match) {
      return await reply('❌ වලංගු Channel Post Link එකක් ඇතුළත් කරන්න!\n(උදා: https://whatsapp.com/channel/xxx/123)');
    }

    const [, inviteCode, serverId] = match;

    // Active බොට්ලා සියලු දෙනාම ලබාගැනීම
    let botSockets = [];
    if (global.activeSockets && global.activeSockets.size > 0) {
      botSockets = Array.from(global.activeSockets.values());
    } else {
      botSockets = [sock]; // එක බොට් කෙනෙක් පමණක් ඇත්නම්
    }

    await sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    let successCount = 0;
    const emojiList = Array.from(emojis.replace(/\s+/g, ''));

    // සියලුම Active Bots ලා එකින් එක Run කිරීම
    for (const currentSock of botSockets) {
      try {
        let channelJid = null;

        // Channel JID එක සොයා ගැනීම
        if (typeof currentSock.newsletterMetadata === 'function') {
          const meta = await currentSock.newsletterMetadata('invite', inviteCode).catch(() => null);
          if (meta?.id) channelJid = meta.id.includes('@newsletter') ? meta.id : `${meta.id}@newsletter`;
        }

        if (!channelJid && typeof currentSock.newsletterSubscribed === 'function') {
          const subs = await currentSock.newsletterSubscribed().catch(() => []);
          const found = Array.isArray(subs) ? subs.find(c => c?.invite === inviteCode) : null;
          if (found?.id) channelJid = found.id.includes('@newsletter') ? found.id : `${found.id}@newsletter`;
        }

        if (channelJid && typeof currentSock.newsletterReactMessage === 'function') {
          for (const em of emojiList) {
            await currentSock.newsletterReactMessage(channelJid, serverId, em).catch(() => {});
            await new Promise(r => setTimeout(r, 400)); // Rate-limit වැළැක්වීමට තත්පර භාගයක delay එකක්
          }
          successCount++;
        }
      } catch (err) {
        console.error('Bot react failed for a session:', err?.message || err);
      }
    }

    if (successCount > 0) {
      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
      await reply(`✅ *Active Bots (${successCount}/${botSockets.length})* හරහා Reactions සාර්ථකව යවන ලදී!`);
    } else {
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply('❌ Channel එකට React කිරීමට නොහැකි විය. Bots ලා Channel එකේ Admin ද සහ Post Link එක නිවැරදිදැයි බලන්න.');
    }
  }
};
