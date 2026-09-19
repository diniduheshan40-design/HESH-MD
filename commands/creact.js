// commands/creact.js
const NodeCache = require('node-cache');

// Default Random Emojis Pool
const DEFAULT_REACTIONS = ['💗', '❤️', '🥰', '😯', '🔥', '✨', '👍', '🪄'];

// Owner Numbers List
const OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '72787431583987'
];

// ⚡ Fast Newsletter JID Resolution Cache (24 hours TTL)
const channelCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

module.exports = {
  name: "creact",
  alias: ["channelreact", "creaction"],
  category: "owner",
  desc: "React to channel post using main bot and active sub-bots",

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = chatJid || msg.key.remoteJid;
    const isGroup = targetChat.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || '') : targetChat;
    
    // Fast Owner Verification
    const isOwner = options.isOwner || 
                    msg.key.fromMe || 
                    OWNER_NUMBERS.some(num => String(sender).includes(num));

    const reply = async (text) => {
      if (safeReply) return await safeReply(text);
      return await sock.sendMessage(targetChat, { text }, { quoted: msg });
    };

    if (!isOwner) {
      return await reply("⛔ *Access Denied!* Only the owner can use this command.");
    }

    try {
      let channelJid;
      let messageId;
      let emojisString = "";

      const rawText = msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text || 
                      args.join(' ');

      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const linkMatch = rawText.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)\/(\d+)/);

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

          // Fallback MEX Query එක
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
        emojisString = args.join("");

        if (!channelJid || !channelJid.endsWith('@newsletter')) {
          return await reply("❌ කරුණාකර නිවැරදි Channel Post එකකට reply කරන්න.");
        }
      } else {
        const usageMsg = 
          "📌 *භාවිතය:*\n" +
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

      // ⚡ Direct Fast Reaction Execution
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

      // 1. Main Bot React
      let successCount = 0;
      try {
        await sendReact(sock);
        successCount++;
      } catch (mainErr) {
        console.error("Main bot react failed:", mainErr.message);
      }

      // 2. Active Sub-bots React (Batched Concurrent Execution)
      const sessionsSource = (typeof global.activeSessions === 'object' && global.activeSessions !== null) 
        ? global.activeSessions 
        : (typeof activeSessions === 'object' && activeSessions !== null ? activeSessions : {});

      const subBots = Object.values(sessionsSource).filter(bot => bot && bot !== sock && bot.user);

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
        `• *Reactions*   : ${uniqueReactions.join(' ')}\n` +
        `• *සාර්ථකයි*    : ${successCount} Bots\n` +
        `━━━━━━━━━━━━━━━━━━━━━`;

      return await reply(successMsg);

    } catch (err) {
      console.error("Creact Error:", err.message);
      return await reply("❌ Reaction දැමීම අසාර්ථක විය! Link එක පරීක්ෂා කරන්න.");
    }
  }
};

