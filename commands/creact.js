// commands/creact.js
const NodeCache = require('node-cache');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// 👑 EXCLUSIVE DEVELOPER NUMBER
const DEVELOPER_NUMBER = '94719845166';

// Default Random Emojis Pool
const DEFAULT_REACTIONS = ['💗', '❤️', '🥰', '😯', '🔥', '✨', '👍', '🪄'];

// ⚡ Fast Newsletter JID Resolution Cache (24 hours TTL)
const channelCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

module.exports = {
  name: "creact",
  alias: ["channelreact", "creaction"],
  category: "developer",
  desc: "React to channel post using all active bot sessions (Developer Only)",

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key.remoteJid;
    if (!targetChat) return;

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
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

    // ⛔ 2. STRICT DEVELOPER CHECK
    if (cleanSenderNum !== DEVELOPER_NUMBER) {
      return await reply('⛔ *Access Denied!* මෙම Command එක භාවිත කළ හැක්කේ ප්‍රධාන Developer හට පමණි (+94719845166).');
    }

    try {
      let channelJid;
      let messageId;
      let emojisString = "";

      const rawText = msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text || 
                      (Array.isArray(args) ? args.join(' ') : String(args || ''));

      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const linkMatch = rawText.match(/(?:whatsapp\.com\/channel\/)([a-zA-Z0-9]{20,26})\/(\d+)/i);

      if (linkMatch) {
        const inviteCode = linkMatch[1];
        messageId = linkMatch[2];

        const afterLink = rawText.substring(rawText.indexOf(linkMatch[0]) + linkMatch[0].length);
        emojisString = afterLink.replace(/^[,\s|]+/, '').trim();

        // ⚡ Cache එකෙන් JID එක ලබාගැනීම
        channelJid = channelCache.get(inviteCode);

        if (!channelJid) {
          try {
            if (typeof sock.newsletterMetadata === 'function') {
              const metadata = await sock.newsletterMetadata("invite", inviteCode);
              channelJid = metadata?.id;
            }
          } catch (e) {}

          // Fallback MEX Query
          if (!channelJid) {
            try {
              const result = await sock.query({
                tag: 'iq',
                attrs: { to: 's.whatsapp.net', xmlns: 'w:mex', type: 'get' },
                content: [{
                  tag: 'query',
                  attrs: { query_id: '6620195908089573' },
                  content: Buffer.from(JSON.stringify({
                    variables: { input: { key: inviteCode, type: 'INVITE' } }
                  }))
                }]
              });
              const rawData = result?.content?.[0]?.content?.toString();
              if (rawData) {
                const parsed = JSON.parse(rawData);
                channelJid = parsed?.data?.xwa2_newsletter?.id;
              }
            } catch (e) {}
          }

          if (channelJid) channelCache.set(inviteCode, channelJid);
        }

        if (!channelJid) {
          return await reply("❌ චැනල් ලින්ක් එක වැරදියි හෝ විස්තර ලබාගත නොහැක!");
        }
      } 
      else if (quotedMsg) {
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        channelJid = contextInfo?.remoteJid;
        messageId = contextInfo?.server_id || contextInfo?.stanzaId;
        emojisString = Array.isArray(args) ? args.join("") : String(args || '');

        if (!channelJid || !channelJid.endsWith('@newsletter')) {
          return await reply("❌ කරුණාකර නිවැරදි Channel Post එකකට reply කරන්න.");
        }
      } else {
        const usageMsg = 
          "📌 *භාවිතය:*\n\n" +
          "• `.creact <channel_post_link>` (Random Emojis auto වැටේ)\n" +
          "• `.creact <channel_post_link> 💗,❤️,🥰`\n" +
          "• හෝ චැනල් පෝස්ට් එකකට reply කර: `.creact 🩷💜❤️`";
        return await reply(usageMsg);
      }

      // Emojis Array එක සකසා ගැනීම
      let emojiArray = [];
      if (emojisString) {
        if (emojisString.includes(',')) {
          emojiArray = emojisString.split(',').map(e => e.trim()).filter(Boolean);
        } else {
          emojiArray = Array.from(emojisString.replace(/[\s,]+/g, ''));
        }
      }

      if (emojiArray.length === 0) {
        emojiArray = DEFAULT_REACTIONS;
      }

      const appliedReactions = [];

      // ⚡ Direct Reaction Execution Helper
      const sendReact = async (botInstance) => {
        const pickedEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];

        if (typeof botInstance.newsletterReactMessage === 'function') {
          await botInstance.newsletterReactMessage(channelJid, messageId, pickedEmoji);
        } else {
          await botInstance.sendMessage(channelJid, {
            react: {
              text: pickedEmoji,
              key: {
                remoteJid: channelJid,
                server_id: messageId,
                id: messageId,
                fromMe: false
              }
            }
          });
        }
        appliedReactions.push(pickedEmoji);
        return true;
      };

      // 1. Main Bot Reaction
      let successCount = 0;
      try {
        await sendReact(sock);
        successCount++;
      } catch (mainErr) {
        console.error("Main bot react failed:", mainErr?.message);
      }

      // 2. Real Active Sub-bots Reaction (Dead / Disconnected sessions skip කරනු ලැබේ)
      const sessionsSource = global.activeSessions || {};
      const subBots = Object.values(sessionsSource).filter(bot => {
        return bot && 
               bot !== sock && 
               bot.user?.id && 
               (bot.ws?.readyState === 1 || bot.ws?.socket?.readyState === 1);
      });

      // Sub-bots batches of 4 to prevent socket bottleneck
      const BATCH_SIZE = 4;
      for (let i = 0; i < subBots.length; i += BATCH_SIZE) {
        const batch = subBots.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(b => sendReact(b)));
        successCount += results.filter(r => r.status === 'fulfilled').length;
        if (i + BATCH_SIZE < subBots.length) {
          await new Promise(r => setTimeout(r, 400));
        }
      }

      const uniqueReactions = [...new Set(appliedReactions)];
      const successMsg = 
        `*✦ REACTION SUCCESSFUL ✦*\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *Reactions*   : ${uniqueReactions.join(' ') || '✅'}\n` +
        `• *සාර්ථකයි*    : ${successCount} Bots\n` +
        `• *Developer*   : +${DEVELOPER_NUMBER}\n` +
        `━━━━━━━━━━━━━━━━━━━━━`;

      return await reply(successMsg);

    } catch (err) {
      console.error("Creact Error:", err?.message || err);
      return await reply("❌ Reaction දැමීම අසාර්ථක විය! Link එක සහ Permissions පරීක්ෂා කරන්න.");
    }
  }
};
