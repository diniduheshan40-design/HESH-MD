module.exports = {
    name: "tagall",
    category: "group",
    desc: "Tag all group members",
    async run({ conn, m, args }) {
        if (!m.isGroup) return await m.reply("මේක Group වල විතරයි පාවිච්චි කරන්න පුළුවන්!");
        
        const groupMetadata = await conn.groupMetadata(m.chat);
        const participants = groupMetadata.participants;
        const customMsg = args.join(" ") || "Attention Everyone! 📢";

        let text = `╭───「 *ANNOUNCEMENT* 」\n│\n`;
        text += `│ 💬 *Message:* ${customMsg}\n│ 👥 *Members:* ${participants.length}\n│\n`;
        
        for (let mem of participants) {
            text += `│ 👤 @${mem.id.split('@')[0]}\n`;
        }
        text += `╰───────────────`;

        await conn.sendMessage(m.chat, {
            text: text,
            mentions: participants.map(a => a.id)
        }, { quoted: m });
    }
};

