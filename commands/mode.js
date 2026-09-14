module.exports = {
    name: 'mode',
    async execute(sock, msg, args, sender) {
        // Owner පරීක්ෂා කිරීම (Bot එක run වන number එකෙන් පමණක් settings මාරු කළ හැක)
        const isOwner = msg.key.fromMe;
        if (!isOwner) {
            return await sock.sendMessage(sender, { 
                text: "⛔ *Access Denied!* Only the bot owner can change settings." 
            }, { quoted: msg });
        }

        const inputMode = args[0]?.toLowerCase();

        if (inputMode === 'public') {
            global.botMode = 'public';
            return await sock.sendMessage(sender, { 
                text: "🌐 *BOT MODE UPDATED*\n\nMode: *PUBLIC* 🟢\n> දැන් ඕනෑම කෙනෙකුට බොට් භාවිත කළ හැක." 
            }, { quoted: msg });
        } 
        else if (inputMode === 'private') {
            global.botMode = 'private';
            return await sock.sendMessage(sender, { 
                text: "🔒 *BOT MODE UPDATED*\n\nMode: *PRIVATE* 🔴\n> දැන් බොට් ක්‍රියා කරන්නේ Owner ට පමණි." 
            }, { quoted: msg });
        } 
        else if (inputMode === 'group') {
            global.botMode = 'group';
            return await sock.sendMessage(sender, { 
                text: "👥 *BOT MODE UPDATED*\n\nMode: *GROUP ONLY* 🟡\n> බොට් ක්‍රියා කරන්නේ Groups තුළ පමණි." 
            }, { quoted: msg });
        } 
        else {
            const current = global.botMode || 'public';
            const settingText = `
╭───〔 ⚙️ *BOT SETTINGS PANEL* 〕───╮
│
├▸ *Current Mode:* \`${current.toUpperCase()}\`
│
├─╼〔 *AVAILABLE MODES* 〕
│  ◇ *.mode public* - Open for everyone
│  ◇ *.mode private* - Owner only
│  ◇ *.mode group* - Groups only
│
╰────────────────────────────────╯
> *Usage:* Send \`.mode public\` to switch mode.`.trim();

            return await sock.sendMessage(sender, { text: settingText }, { quoted: msg });
        }
    }
};

