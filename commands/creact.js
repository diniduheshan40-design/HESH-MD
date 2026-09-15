module.exports = {
    name: "creact",
    category: "tools",
    desc: "React randomly to channel posts",
    async run({ conn, m, args }) {
        try {
            if (!m.quoted) {
                return await m.reply("කරුණාකර අදාළ channel post එකට reply කර ඉමෝජි ලබා දෙන්න!\nඋදා: `.creact 🩷💜❤️🖤🤍💘`");
            }

            let emojisString = args.join("");
            let emojiArray = Array.from(emojisString);

            if (emojiArray.length === 0) {
                return await m.reply("කරුණාකර emoji කිහිපයක් ලබා දෙන්න!");
            }

            // අහඹු ලෙස එකක් තෝරා ගැනීම
            let randomEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];

            await conn.sendMessage(m.quoted.chat, {
                react: {
                    text: randomEmoji,
                    key: {
                        remoteJid: m.quoted.chat,
                        id: m.quoted.id,
                        fromMe: false
                    }
                }
            });

            await m.reply(`සාර්ථකයි! Reaction එක: ${randomEmoji}`);
        } catch (err) {
            console.error(err);
            await m.reply("Reaction එක දැමීමට නොහැකි විය!");
        }
    }
};
