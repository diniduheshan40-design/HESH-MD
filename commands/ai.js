const path = require('path');
// Path resolve safe import
let askAI;
try {
    askAI = require('../ai').askAI;
} catch (e) {
    askAI = require(path.join(__dirname, '../ai')).askAI;
}

module.exports = {
    name: 'ai',
    category: 'ai',
    desc: 'Ask AI or toggle inbox auto-ai',
    async execute(sock, msg, args, targetChat) {
        const chatJid = targetChat || msg.key.remoteJid;
        const option = args[0]?.toLowerCase();

        const isGroup = chatJid.endsWith('@g.us');
        const sender = isGroup ? (msg.key.participant || '') : chatJid;
        const creatorNumber = '94719845166';
        const isOwner = msg.key.fromMe || sender.includes(creatorNumber);

        // 1. Auto AI Switch Controls (Owner Only)
        if (option === 'on') {
            if (!isOwner) {
                return await sock.sendMessage(chatJid, { 
                    text: "⛔ *Access Denied!* Only the bot owner can change AI settings." 
                }, { quoted: msg });
            }
            global.autoAiInbox = true;
            return await sock.sendMessage(chatJid, { 
                text: "🤖 *AUTO AI INBOX: ENABLED* 🟢\n\n> දැන් Inbox එකට එන ඕනෑම පණිවිඩයකට ස්වයංක්‍රීයව AI පිළිතුරු ලබා දේ.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
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
                text: "🤖 *AUTO AI INBOX: DISABLED* 🔴\n\n> Inbox Auto AI පිළිතුරු අක්‍රිය කරන ලදී.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
            }, { quoted: msg });
        }

        // 2. Manual Question Ask via .ai
        const query = args.join(" ").trim();
        if (!query) {
            const helpText = `
╭───〔 🤖 *AI ASSISTANT* 〕───╮
│
├▸ *.ai on* - Enable Inbox Auto Reply
├▸ *.ai off* - Disable Inbox Auto Reply
├▸ *.ai <query>* - Ask a question directly
│
╰────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

            return await sock.sendMessage(chatJid, { text: helpText }, { quoted: msg });
        }

        try {
            await sock.sendPresenceUpdate('composing', chatJid);
            
            const response = await askAI(query, sender);
            
            if (response) {
                await sock.sendMessage(chatJid, { text: response }, { quoted: msg });
            } else {
                await sock.sendMessage(chatJid, { text: "⚠️ AI එකෙන් පිළිතුරක් ලබා ගැනීමට නොහැකි විය." }, { quoted: msg });
            }
        } catch (err) {
            console.error('AI Command Error:', err.message);
            await sock.sendMessage(chatJid, { text: "❌ AI engine failure. Please try again later." }, { quoted: msg });
        } finally {
            try {
                await sock.sendPresenceUpdate('paused', chatJid);
            } catch (e) {}
        }
    }
};
