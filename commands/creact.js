// Default Random Emojis Pool (Emoji ලබා නොදුනහොත් මේවායින් Random වැටේ)
const DEFAULT_REACTIONS = ['💗', '❤️', '🥰', '😯', '🔥', '✨', '👍', '🪄'];

module.exports = {
  name: "creact",
  alias: ["channelreact", "creaction"],
  category: "owner",
  desc: "React to channel post using main bot and active sub-bots",

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key.remoteJid;
    const isGroup = targetChat.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || '') : targetChat;
    const creatorNumber = '94719845166';
    const isOwner = msg.key.fromMe || sender.includes(creatorNumber);

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

      // 1. Link එක හරහා දත්ත ලබා ගැනීම
      if (linkMatch) {
        const inviteCode = linkMatch[1];
        messageId = linkMatch[2];

        // Link එකෙන් පසු ඇති emojis ලබා ගැනීම
        const afterLink = rawText.substring(rawText.indexOf(linkMatch[0]) + linkMatch[0].length);
        emojisString = afterLink.replace(/^[,\s|]+/, '').trim();

        // Newsletter JID එක Resolve කිරීම
        let metadata = null;
        try {
          if (typeof sock.newsletterMetadata === 'function') {
            metadata = await sock.newsletterMetadata("invite", inviteCode);
          }
        } catch (e) {}

        channelJid = metadata?.id;

        // Fallback Query එක
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

        if (!channelJid) {
          return await reply("❌ චැනල් ලින්ක් එක වැරදියි හෝ විස්තර ලබාගත නොහැක!");
        }
      } 
      // 2. Quoted Channel Post එකක් හරහා
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
          "• `.creact <channel_post_link> , 💗,❤️,🥰,😯`\n" +
          "• හෝ චැනල් පෝස්ට් එකකට reply කර: `.creact 🩷💜❤️`";
        return await reply(usageMsg);
      }

      // Emojis Pool එක සාදා ගැනීම
      let emojiArray = [];
      if (emojisString) {
        if (emojisString.includes(',')) {
          emojiArray = emojisString.split(',').map(e => e.trim()).filter(Boolean);
        } else {
          emojiArray = Array.from(emojisString.replace(/\s+/g, ''));
        }
      }

      // Emojis කිසිවක් ලබාදී නැතිනම් Default Emojis භාවිතා වේ
      if (emojiArray.length === 0) {
        emojiArray = DEFAULT_REACTIONS;
      }

      let successCount = 0;
      const appliedReactions = [];

      // Helper function: Reaction එක Channel එකට නිවැරදි Protocol එකෙන් යැවීම
      const sendReact = async (botInstance) => {
        const pickedEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];

        // 1. Auto-Follow Channel (හැකි නම්)
        try {
          if (typeof botInstance.newsletterFollow === 'function') {
            await botInstance.newsletterFollow(channelJid);
          }
        } catch (e) {}

        // 2. Baileys Official Channel Reaction
        if (typeof botInstance.newsletterReactMessage === 'function') {
          await botInstance.newsletterReactMessage(channelJid, messageId, pickedEmoji);
        } else {
          // 3. Binary Node Fallback Reaction
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
      };

      // පියවර 1: Main Bot ගෙන් Reaction එක දැමීම
      try {
        await sendReact(sock);
        successCount++;
      } catch (mainErr) {
        console.error("Main bot react failed:", mainErr.message);
      }

      // පියවර 2: Active Sub-bots (Global activeSessions) හරහා React කරවීම
      const sessionsSource = (typeof global.activeSessions === 'object' && global.activeSessions !== null) 
        ? global.activeSessions 
        : (typeof activeSessions === 'object' && activeSessions !== null ? activeSessions : {});

      const subBotKeys = Object.keys(sessionsSource);
      for (const botNum of subBotKeys) {
        const subBot = sessionsSource[botNum];
        if (subBot && subBot !== sock && subBot.user) {
          try {
            await new Promise(res => setTimeout(res, 1200));
            await sendReact(subBot);
            successCount++;
          } catch (subErr) {
            console.log(`Sub-bot (+${botNum}) react failed:`, subErr.message);
          }
        }
      }

      const successMsg = 
        `*✦ REACTION SUCCESSFUL ✦*\n━━━━━━━━━━━━━━━━━━━━━\n` +
        `• *Reactions*   : ${appliedReactions.join(' ')}\n` +
        `• *සාර්ථකයි*    : ${successCount} Bots\n` +
        `━━━━━━━━━━━━━━━━━━━━━`;

      return await reply(successMsg);

    } catch (err) {
      console.error("Creact Error:", err.message);
      return await reply("❌ Reaction දැමීම අසාර්ථක විය! Link එක හෝ Permissions පරීක්ෂා කරන්න.");
    }
  }
};

