const { askAI } = require('../ai');

module.exports = {
    name: 'ai',
    async execute(sock, msg, args, sender) {
        const option = args[0]?.toLowerCase();
        const isOwner = msg.key.fromMe;

        // 1. Auto AI Switch Controls (Owner Only)
        if (option === 'on') {
            if (!isOwner) {
                return await sock.sendMessage(sender, { text: "⛔ *Access Denied!* Only the bot owner can change AI settings." }, { quoted: msg });
            }
            global.autoAiInbox = true;
            return await sock.sendMessage(sender, { 
                text: "🤖 *AUTO AI INBOX: ENABLED* 🟢\n\n> දැන් Inbox එකට එන ඕනෑම පණිවිඩයකට ස්වයංක්‍රීයව AI පිළිතුරු ලබා දේ." 
            }, { quoted: msg });
        }

        if (option === 'off') {
            if (!isOwner) {
                return await sock.sendMessage(sender, { text: "⛔ *Access Denied!* Only the bot owner can change AI settings." }, { quoted: msg });
            }
            global.autoAiInbox = false;
            return await sock.sendMessage(sender, { 
                text: "🤖 *AUTO AI INBOX: DISABLED* 🔴\n\n> Inbox Auto AI පිළිතුරු අක්‍රිය කරන ලදී." 
            }, { quoted: msg });
        }

        // 2. Manual Question Ask via .ai
        const query = args.join(" ");
        if (!query) {
            return await sock.sendMessage(sender, { 
                text: `╭───〔 🤖 *AI ASSISTANT* 〕───╮\n│\n├▸ *.ai on* - Enable Inbox Auto Reply\n├▸ *.ai off* - Disable Inbox Auto Reply\n├▸ *.ai <query>* - Ask a question directly\n│\n╰────────────────────────────╯` 
            }, { quoted: msg });
        }

        try {
            await sock.sendPresenceUpdate('composing', sender);
            const response = await askAI(query);
            await sock.sendMessage(sender, { text: response }, { quoted: msg });
            await sock.sendPresenceUpdate('paused', sender);
        } catch (err) {
            console.error('AI Command Error:', err);
            await sock.sendMessage(sender, { text: "❌ AI engine failure. Please try again later." }, { quoted: msg });
        }
    }
};

