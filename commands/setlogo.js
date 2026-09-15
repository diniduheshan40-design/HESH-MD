// commands/setlogo.js
const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'setlogo',
    category: 'owner',
    desc: 'Set custom bot logo image',

    async execute(sock, msg, args, chatJid, safeReply) {
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        try {
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

            // Project Root එකේ logo.jpg විදියට Save කිරීම
            const logoPath = path.join(process.cwd(), 'logo.jpg');
            fs.writeFileSync(logoPath, buffer);

            // සාර්ථක වූ බවට දැනුම්දීම
            await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: '✅ *HESHAN-MD Logo එක සාර්ථකව Update කරන ලදී!*\n\nදැන් `.alive` ගසා පරීක්ෂා කර බලන්න.' 
            }, { quoted: msg });

        } catch (err) {
            console.error("Setlogo Error:", err);
            await sock.sendMessage(targetChat, { 
                text: `❌ Error: ${err.message}` 
            }, { quoted: msg });
        }
    }
};

