module.exports = {
  name: "creact",
  category: "owner",
  desc: "React to channel post using main bot and active sub-bots",

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key.remoteJid;
    const isGroup = targetChat.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || '') : targetChat;
    const creatorNumber = '94719845166';
    const isOwner = msg.key.fromMe || sender.includes(creatorNumber);

    if (!isOwner) {
      return await (safeReply ? safeReply("⛔ *Access Denied!* Only the owner can use this command.") : sock.sendMessage(targetChat, { text: "⛔ *Access Denied!*" }, { quoted: msg }));
    }

    try {
      let channelJid;
      let messageId;
      let emojisString;

      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      // 1. Link එක හරහා දත්ත ලබා ගැනීම: .creact <link> <emojis>
      if (args[0] && args[0].includes('whatsapp.com/channel/')) {
        const fullLink = args[0].trim();
        const linkParts = fullLink.split('/');
        messageId = linkParts[linkParts.length - 1].split('?')[0];
        emojisString = args.slice(1).join("");

        const inviteCode = linkParts[4];
        let metadata = null;
        try {
          if (typeof sock.newsletterMetadata === 'function') {
            metadata = await sock.newsletterMetadata("invite", inviteCode);
          }
        } catch (e) {}

        if (!metadata || !metadata.id) {
          const errMsg = "❌ චැනල් ලින්ක් එක වැරදියි හෝ විස්තර ලබාගත නොහැක!";
          return await (safeReply ? safeReply(errMsg) : sock.sendMessage(targetChat, { text: errMsg }, { quoted: msg }));
        }
        channelJid = metadata.id;
      } 
      // 2. Quoted Post එකක් හරහා: .creact <emojis>
      else if (quotedMsg) {
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        channelJid = contextInfo?.remoteJid;
        messageId = contextInfo?.stanzaId;
        emojisString = args.join("");
      } else {
        const usageMsg = "📌 *භාවිතය:*\n• `.creact <channel_post_link> 🩷💜❤️🖤🤍`\n• හෝ චැනල් පෝස්ට් එකකට reply කර: `.creact 🩷💜❤️🖤🤍`";
        return await (safeReply ? safeReply(usageMsg) : sock.sendMessage(targetChat, { text: usageMsg }, { quoted: msg }));
      }

      // Emojis Array එකකට වෙන් කරගැනීම
      const emojiArray = Array.from(emojisString.trim());
      if (emojiArray.length === 0) {
        const noEmojiMsg = "⚠️ කරුණාකර Reaction සඳහා Emoji එකක් හෝ කිහිපයක් ලබා දෙන්න!";
        return await (safeReply ? safeReply(noEmojiMsg) : sock.sendMessage(targetChat, { text: noEmojiMsg }, { quoted: msg }));
      }

      let successCount = 0;

      // Helper function: Reaction එක යැවීමට
      const sendReact = async (botInstance) => {
        const pickedEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];
        await botInstance.sendMessage(channelJid, {
          react: {
            text: pickedEmoji,
            key: {
              remoteJid: channelJid,
              id: messageId,
              fromMe: false
            }
          }
        });
      };

      // පියවර 1: Main Bot ගෙන් Reaction එක දැමීම
      try {
        await sendReact(sock);
        successCount++;
      } catch (mainErr) {
        console.error("Main bot react failed:", mainErr.message);
      }

      // පියවර 2: Active Sub-bots (activeSessions) හරහා React කරවීම
      if (typeof activeSessions === 'object' && activeSessions !== null) {
        const subBotKeys = Object.keys(activeSessions);
        for (const botNum of subBotKeys) {
          const subBot = activeSessions[botNum];
          if (subBot && subBot !== sock && subBot.user && subBot.ws?.socket?.readyState === 1) {
            try {
              await new Promise(res => setTimeout(res, 600));
              await sendReact(subBot);
              successCount++;
            } catch (subErr) {
              console.log(`Sub-bot (+${botNum}) react failed:`, subErr.message);
            }
          }
        }
      }

      const successMsg = `✅ *සාර්ථකයි!*\n\nබොට්ලා ${successCount} දෙනෙකුගෙන් Reactions යැව්වා.`;
      return await (safeReply ? safeReply(successMsg) : sock.sendMessage(targetChat, { text: successMsg }, { quoted: msg }));

    } catch (err) {
      console.error("Creact Error:", err.message);
      const failMsg = "❌ Reaction දැමීම අසාර්ථක විය! Link එක හෝ Permissions පරීක්ෂා කරන්න.";
      return await (safeReply ? safeReply(failMsg) : sock.sendMessage(targetChat, { text: failMsg }, { quoted: msg }));
    }
  }
};
