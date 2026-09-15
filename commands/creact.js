module.exports = {
    name: "creact",
    category: "owner",
    desc: "React to channel post using main bot and all active sub-bots",
    async run({ conn, m, args }) {
        try {
            let channelJid;
            let messageId;
            let emojisString;

            // 1. Link එක හරහා දත්ත ලබා ගැනීම: .creact <link> <emojis>
            if (args[0] && args[0].includes('whatsapp.com/channel')) {
                let linkParts = args[0].split('/');
                messageId = linkParts[linkParts.length - 1];
                emojisString = args.slice(1).join("");

                let inviteCode = linkParts[4];
                let metadata = await conn.newsletterMetadata("invite", inviteCode).catch(() => null);
                if (!metadata) return await m.reply("චැනල් ලින්ක් එක වැරදියි හෝ ලබාගත නොහැක!");
                channelJid = metadata.id;
            } 
            // 2. Quoted Post එකක් හරහා දත්ත ලබා ගැනීම: .creact <emojis>
            else if (m.quoted) {
                channelJid = m.quoted.chat;
                messageId = m.quoted.id;
                emojisString = args.join("");
            } else {
                return await m.reply("භාවිතය:\n• `.creact <channel_post_link> 🩷💜❤️🖤🤍`\n• හෝ චැනල් පෝස්ට් එකකට reply කර: `.creact 🩷💜❤️🖤🤍`");
            }

            // Emojis Array එකකට වෙන් කරගැනීම
            let emojiArray = Array.from(emojisString.trim());
            if (emojiArray.length === 0) {
                return await m.reply("කරුණාකර කලවමේ දැමීමට Emoji කිහිපයක් ලබා දෙන්න!");
            }

            let successCount = 0;

            // Helper function: Reaction එක යැවීමට
            const sendReact = async (botInstance) => {
                let pickedEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];
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
            await sendReact(conn);
            successCount++;

            // පියවර 2: Active Sub-bots (Clones) ලූපය හරහා React කරවීම
            if (global.conns && Array.isArray(global.conns) && global.conns.length > 0) {
                for (let subBot of global.conns) {
                    // බොට් Online ද කියා පරීක්ෂා කිරීම
                    if (subBot.user && subBot.ws?.socket?.readyState === 1) {
                        try {
                            // Numbers Ban නොවීමට තත්පර 0.5 ක කුඩා delay එකක්
                            await new Promise(res => setTimeout(res, 500));
                            await sendReact(subBot);
                            successCount++;
                        } catch (botErr) {
                            console.log("Sub-bot එකකින් react දැමීම අසාර්ථක විය:", botErr.message);
                        }
                    }
                }
            }

            await m.reply(`සාර්ථකයි! බොට්ලා ${successCount} දෙනෙකුගෙන් Reactions යැව්වා. ✅`);

        } catch (err) {
            console.error(err);
            await m.reply("Reaction දැමීම අසාර්ථක විය! Link එක හෝ Permissions පරීක්ෂා කරන්න.");
        }
    }
};
