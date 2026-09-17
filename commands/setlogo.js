// commands/setlogo.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Database Model
const SettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  botLogo: { type: String, default: 'https://files.catbox.moe/a58add.jpeg' }
}, { strict: false });

const SettingsModel = mongoose.models.BotSettings || mongoose.model('BotSettings', SettingsSchema);

module.exports = {
    name: 'setlogo',
    category: 'owner',
    desc: 'Set custom bot logo image for this bot instance',

    async execute(sock, msg, args, chatJid, safeReply) {
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        try {
            // මේ Command එක Run කරපු අදාළ Bot ගේ අංකය වෙන් කර හඳුනා ගැනීම
            const myBotNum = (sock.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
            if (!myBotNum) {
                return sock.sendMessage(targetChat, { text: '⚠️ Bot Number හඳුනාගත නොහැකි විය.' }, { quoted: msg });
            }

            // Reaction
            sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

            // Photo එක direct එවපු එකක්ද නැත්නම් Quoted (Reply) කරපු එකක්ද කියා හඳුනාගැනීම
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            let targetMsg = null;

            if (msg.message?.imageMessage) {
                targetMsg = msg;
            } else if (quotedMsg?.imageMessage) {
                targetMsg = {
                    key: {
                        remoteJid: targetChat,
                        id: msg.message?.extendedTextMessage?.contextInfo?.stanzaId
                    },
                    message: quotedMsg
                };
            }

            if (!targetMsg) {
                return sock.sendMessage(targetChat, { 
                    text: '⚠️ කරුණාකර Logo එක ලෙස දැමීමට අවශ්‍ය Photo එකක් සමඟ `.setlogo` යොදන්න (හෝ Photo එකකට reply කර `.setlogo` යොදන්න).' 
                }, { quoted: msg });
            }

            // Image එක Download කර Buffer එකක් ලබා ගැනීම
            const buffer = await downloadMediaMessage(
                targetMsg,
                'buffer',
                {},
                { 
                    logger: console,
                    reuploadRequest: sock.updateMediaMessage
                }
            );

            if (!buffer || buffer.length === 0) {
                return sock.sendMessage(targetChat, { 
                    text: '❌ Image එක Download කරගැනීමට නොහැකි විය. නැවත උත්සාහ කරන්න.' 
                }, { quoted: msg });
            }

            // එක් එක් බොට්ගේ අංකයට වෙනම File එකක් සාදා ගැනීම (උදා: logo_9470xxxxxxx.jpg)
            const botLogoPath = path.join(process.cwd(), `logo_${myBotNum}.jpg`);
            fs.writeFileSync(botLogoPath, buffer);

            // Database එකේ මේ Bot Number එකට පමණක් Logo එක Update කර තැබීම
            await SettingsModel.findByIdAndUpdate(
                myBotNum,
                { $set: { botLogo: botLogoPath } },
                { upsert: true, new: true }
            );

            // Settings Cache එක Clear කිරීම
            if (global.clearSettingsCache) global.clearSettingsCache(myBotNum);

            // සාර්ථක වූ බවට දැනුම්දීම
            await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `✅ *[+${myBotNum}] Logo එක සාර්ථකව Update කරන ලදී!*\n\nදැන් \`.menu\` ගසා පරීක්ෂා කර බලන්න.` 
            }, { quoted: msg });

        } catch (err) {
            console.error("Setlogo Error:", err);
            await sock.sendMessage(targetChat, { 
                text: `❌ Error: ${err.message}` 
            }, { quoted: msg });
        }
    }
};
