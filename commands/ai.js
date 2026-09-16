// commands/ai.js
const path = require('path');

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
    async execute(sock, msg, args, targetChat, safeReply, extra = {}) {
        const chatJid = (typeof targetChat === 'string' && targetChat.includes('@')) 
            ? targetChat 
            : msg.key.remoteJid;

        const option = args[0]?.toLowerCase();

        // 🟢 Bulletproof Owner Detection (index.js fallback included)
        const isGroup = chatJid.endsWith('@g.us');
        const rawSender = msg.key.fromMe 
            ? (sock.user?.id || '') 
            : (isGroup ? (msg.key.participant || msg.participant || '') : chatJid);
        
        const cleanSender = rawSender.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        const myBotNum = (sock.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        const creatorNumber = '94719845166';

        const isOwner = extra?.isOwner || 
                        cleanSender.includes(creatorNumber) || 
                        (msg.key.fromMe && myBotNum.includes(creatorNumber));

        // 1. Auto AI Switch Controls (Owner Only)
        if (option === 'on') {
            if (!isOwner) {
                return await sock.sendMessage(chatJid, { 
                    text: "⛔ *Access Denied!* Only the bot owner can change AI settings." 
                }, { quoted: msg });
            }
            global.autoAiInbox = true;
            return await sock.sendMessage(chatJid, { 
                text: "┏━━━❮ 🤖 *AUTO AI INBOX* ❯━━━┓\n┃\n┃ ◈ *Status* : *ENABLED 🟢*\n┃ ◈ *Mode*   : Auto-reply Active\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━┛\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
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
                text: "┏━━━❮ 🤖 *AUTO AI INBOX* ❯━━━┓\n┃\n┃ ◈ *Status* : *DISABLED 🔴*\n┃ ◈ *Mode*   : Auto-reply Muted\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━┛\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
            }, { quoted: msg });
        }

        // 2. Manual Question Ask via .ai
        const query = args.join(" ").trim();
        if (!query) {
            const helpText = `┏━━━❮ 🤖 *AI ASSISTANT* ❯━━━┓
┃
┃ ◈ \`.ai on\`  ⌁ _Enable Inbox AI_
┃ ◈ \`.ai off\` ⌁ _Disable Inbox AI_
┃ ◈ \`.ai <text>\` ⌁ _Ask any question_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

            return await sock.sendMessage(chatJid, { text: helpText }, { quoted: msg });
        }

        try {
            await sock.sendMessage(chatJid, { react: { text: "🧠", key: msg.key } }).catch(() => {});
            await sock.sendPresenceUpdate('composing', chatJid);
            
            const response = await askAI(query, rawSender);
            
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
