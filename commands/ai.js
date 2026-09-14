const { askAI } = require('../ai');

module.exports = {
    name: 'ai',
    async execute(sock, msg, args, targetChat) {
        // targetChat මඟින් message එක ආපු නියම චැට් එකටම reply යැවීම තහවුරු කරයි
        const chatJid = targetChat || msg.key.remoteJid;
        const option = args[0]?.toLowerCase();
        const isOwner = msg.key.fromMe;

        // 1. Auto AI Switch Controls (Owner Only)
        if (option === 'on') {
            if (!isOwner) {
                return await sock.sendMessage(chatJid, { 
                    text: "⛔ *Access Denied!* Only the bot owner can change AI settings." 
                }, { quoted: msg });
            }
            global.autoAiInbox = true;
            return await sock.sendMessage(chatJid, { 
                text: "🤖 *AUTO AI INBOX: ENABLED* 🟢\n\n> දැන් Inbox එකට එන ඕනෑම පණිවිඩයකට ස්වයංක්‍රීයව AI පිළිතුරු ලබා දේ." 
            }, { quoted: msg });
        }

        if (option === 'off') {
            if (!isOwner) {
                return await sock.sendMessage(chatJid, { 
                    text: "⛔ *Access Denied!* Only the bot owner can change AI settings." 
                }, { quoted: msg });
            }
            global.autoAiInbox = false;
            return await sock.sendMessage(chatJid, { 
                text: "🤖 *AUTO AI INBOX: DISABLED* 🔴\n\n> Inbox Auto AI පිළිතුරු අක්‍රිය කරන ලදී." 
            }, { quoted: msg });
        }

        // 2. Manual Question Ask via .ai
        const query = args.join(" ");
        if (!query) {
            const helpText = `
╭───〔 🤖 *AI ASSISTANT* 〕───╮
│
├▸ *.ai on* - Enable Inbox Auto Reply
├▸ *.ai off* - Disable Inbox Auto Reply
├▸ *.ai <query>* - Ask a question directly
│
╰────────────────────────────╯`.trim();

            return await sock.sendMessage(chatJid, { text: helpText }, { quoted: msg });
        }

        try {
            await sock.sendPresenceUpdate('composing', chatJid);
            const response = await askAI(query);
            
            if (response) {
                await sock.sendMessage(chatJid, { text: response }, { quoted: msg });
            } else {
                await sock.sendMessage(chatJid, { text: "⚠️ AI එකෙන් පිළිතුරක් ලබා ගැනීමට නොහැකි විය." }, { quoted: msg });
            }
            
            await sock.sendPresenceUpdate('paused', chatJid);
        } catch (err) {
            console.error('AI Command Error:', err);
            await sock.sendMessage(chatJid, { text: "❌ AI engine failure. Please try again later." }, { quoted: msg });
        }
    }
};
