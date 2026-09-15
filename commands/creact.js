// creact.js
module.exports = {
    name: "creact",
    category: "tools",
    desc: "Multi-bot channel react",
    async run({ conn, m, args }) {
        try {
            // 1. Post Link එක හෝ Quoted Message එකෙන් විස්තර ගැනීම
            let channelJid;
            let messageId;
            let emojisString;

            // Link එකක් මඟින් දෙනවා නම්: .creact https://whatsapp.com/channel/xxx/123 🩷💜❤️🖤🤍
            if (args[0] && args[0].includes('whatsapp.com/channel')) {
                let linkParts = args[0].split('/');
                messageId = linkParts[linkParts.length - 1];
                emojisString = args.slice(1).join("");
                
                // Link එකෙන් Newsletter JID එක Resolve කරගැනීම
                let inviteCode = linkParts[4];
                let metadata = await conn.newsletterMetadata("invite", inviteCode).catch(() => null);
                if (!metadata) return;
                channelJid = metadata.id;
            } 
            // Quoted Post එකක් නම්: .creact 🩷💜❤️🖤🤍
            else if (m.quoted) {
                channelJid = m.quoted.chat;
                messageId = m.quoted.id;
                emojisString = args.join("");
            } else {
                return await m.reply("කරුණාකර Channel Link එක සහ Emojis ලබා දෙන්න!\nඋදා: `.creact <link> 🩷💜❤️🖤🤍`");
            }

            let emojiArray = Array.from(emojisString.trim());
            if (emojiArray.length === 0) return;

            // හැම බොට්ම අහඹු ලෙස එකිනෙකට වෙනස් emoji එකක් තෝරාගනියි
            let randomEmoji = emojiArray[Math.floor(Math.random() * emojiArray.length)];

            // Reaction එක යැවීම
            await conn.sendMessage(channelJid, {
                react: {
                    text: randomEmoji,
                    key: {
                        remoteJid: channelJid,
                        id: messageId,
                        fromMe: false
                    }
                }
            });

        } catch (err) {
            console.error("React Error:", err);
        }
    }
};
