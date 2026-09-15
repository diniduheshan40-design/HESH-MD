const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: "vv",
    category: "tools",
    desc: "Download and resend view once media",
    async run({ conn, m }) {
        try {
            let quoted = m.quoted ? m.quoted : null;
            let viewOnce = quoted?.message?.viewOnceMessageV2?.message || quoted?.message?.viewOnceMessage?.message;
            
            if (!viewOnce) return await m.reply("කරුණාකර View-Once මැසේජ් එකකට reply කර `.vv` ගහන්න!");

            let type = Object.keys(viewOnce)[0];
            let media = viewOnce[type];
            let stream = await downloadContentFromMessage(media, type === 'imageMessage' ? 'image' : 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            if (type === 'imageMessage') {
                await conn.sendMessage(m.chat, { image: buffer, caption: media.caption || "View-Once Revealed! 🔓" }, { quoted: m });
            } else if (type === 'videoMessage') {
                await conn.sendMessage(m.chat, { video: buffer, caption: media.caption || "View-Once Revealed! 🔓" }, { quoted: m });
            }
        } catch (err) {
            console.error(err);
            await m.reply("View-Once එක ලබාගැනීමට නොහැකි විය!");
        }
    }
};

