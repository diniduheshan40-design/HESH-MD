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
      return await reply('💡 *භාවිතය:* `.creact <channel_post_link>,<emojis>`\n\n📌 *උදා:* `.creact https://whatsapp.com/channel/0029VbC9VEUKQuJCVtJERV1j/541,🔥❤️`');
    }

    const firstComma = rawInput.indexOf(',');
    const postLink = rawInput.substring(0, firstComma).trim();
    const emojis = rawInput.substring(firstComma + 1).trim();

    // Link එකෙන් Invite code සහ Server Post ID එක වෙන් කරගැනීම
    const match = postLink.match(/(?:whatsapp\.com\/channel\/|^)([a-zA-Z0-9]{20,28})\/(\d+)/i);
    if (!match) {
      return await reply('❌ වලංගු Channel Post Link එකක් ඇතුළත් කරන්න!\n(උදා: https://whatsapp.com/channel/0029VbC9VEUKQuJCVtJERV1j/541)');
    }

    const [, inviteCode, serverIdStr] = match;
    const serverId = parseInt(serverIdStr, 10);

    // Active sockets list එක ලබා ගැනීම (activeSessions හෝ activeSockets)
    let botSockets = [];
    if (global.activeSockets && global.activeSockets.size > 0) {
      botSockets = Array.from(global.activeSockets.values());
    } else if (global.activeSessions && Object.keys(global.activeSessions).length > 0) {
      botSockets = Object.values(global.activeSessions);
    } else {
      botSockets = [sock];
    }

    await sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    // 1. ප්‍රථමයෙන් Channel JID එක resolve කරගැනීම (එක් වරක් පමණක් metadata ලබා ගනී)
    let channelJid = null;
    try {
      if (typeof sock.newsletterMetadata === 'function') {
        const meta = await sock.newsletterMetadata('invite', inviteCode).catch(() => null);
        if (meta?.id) channelJid = meta.id.includes('@newsletter') ? meta.id : `${meta.id}@newsletter`;
      }
    } catch (e) {}

    // Fallback: subscribed list එකෙන් බැලීම
    if (!channelJid) {
      for (const s of botSockets) {
        if (typeof s.newsletterSubscribed === 'function') {
          try {
            const subs = await s.newsletterSubscribed().catch(() => []);
            const found = Array.isArray(subs) ? subs.find(c => c?.invite === inviteCode || c?.id?.includes(inviteCode)) : null;
            if (found?.id) {
              channelJid = found.id.includes('@newsletter') ? found.id : `${found.id}@newsletter`;
              break;
            }
          } catch (err) {}
        }
      }
    }

    if (!channelJid) {
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await reply('❌ Channel එක හඳුනාගත නොහැකි විය. Link එක නිවැරදිදැයි බලන්න.');
    }

    // Emoji Split කිරීම (Surrogate pairs / compound emojis ආරක්ෂිතව වෙන් කිරීම)
    const emojiList = [...emojis.replace(/\s+/g, '')];

    let successCount = 0;

    // 2. සියලුම Active Bots ලා හරහා Reactions යැවීම
    for (const currentSock of botSockets) {
      try {
        let reacted = false;

        for (const em of emojiList) {
          // ක්‍රමය 1: Baileys newsletterReactMessage
          if (typeof currentSock.newsletterReactMessage === 'function') {
            await currentSock.newsletterReactMessage(channelJid, serverId, em).catch(async () => {
              // String id fallback
              await currentSock.newsletterReactMessage(channelJid, serverIdStr, em).catch(() => {});
            });
            reacted = true;
          } 
          // ක්‍රමය 2: Direct sendMessage reaction fallback
          else if (typeof currentSock.sendMessage === 'function') {
            await currentSock.sendMessage(channelJid, {
              react: {
                text: em,
                key: {
                  remoteJid: channelJid,
                  server_id: serverId,
                  id: serverIdStr,
                  fromMe: false
                }
              }
            }).catch(() => {});
            reacted = true;
          }

          await new Promise(r => setTimeout(r, 300));
        }

        if (reacted) successCount++;
      } catch (err) {
        console.error('Session reaction error:', err?.message || err);
      }
    }

    if (successCount > 0) {
      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
      await reply(`✅ *Active Bots (${successCount}/${botSockets.length})* හරහා Channel Post එකට Reactions යවන ලදී!`);
    } else {
      await sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply('❌ React කිරීම අසාර්ථක විය. WhatsApp මඟින් reaction එක block කර හෝ server id වැරදි විය හැක.');
    }
  }
};
