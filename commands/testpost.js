// commands/testpost.js
const axios = require('axios');
const { generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

module.exports = {
    name: 'testpost',
    category: 'admin',
    desc: 'Test newsletter direct post and get exact error log',

    async execute(sock, msg, args, chatJid) {
        const from = chatJid || msg.key.remoteJid;
        const channelJid = args[0] || '120363420419246945@newsletter';

        await sock.sendMessage(from, { text: `🔍 Testing post to: ${channelJid}...` }, { quoted: msg });

        try {
            // ක්‍රමය 1: Standard Baileys Newsletter Relay (Media Message)
            const imgRes = await axios.get('https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&q=80', {
                responseType: 'arraybuffer',
                timeout: 15000
            });

            const media = await generateWAMessageContent({
                image: Buffer.from(imgRes.data),
                caption: "⚡ HESHAN-MD Test 4K Wallpaper Post"
            }, { upload: sock.waUploadToServer });

            const fullMsg = generateWAMessageFromContent(channelJid, {
                imageMessage: media.imageMessage
            }, {});

            const res = await sock.relayMessage(channelJid, fullMsg.message, {
                messageId: fullMsg.key.id
            });

            await sock.sendMessage(from, { 
                text: `✅ සාර්ථකයි! Relay Message Response:\n\`\`\`${JSON.stringify(res || 'Success (No Error)', null, 2)}\`\`\`` 
            }, { quoted: msg });

        } catch (err1) {
            console.error('Method 1 failed:', err1);

            // ක්‍රමය 2: Plain Text Fallback Test (Image එකක් නිසාද අවුල කියලා බලන්න)
            try {
                const textMsg = generateWAMessageFromContent(channelJid, {
                    extendedTextMessage: {
                        text: "⚡ HESHAN-MD Newsletter Connectivity Test"
                    }
                }, {});

                await sock.relayMessage(channelJid, textMsg.message, {
                    messageId: textMsg.key.id
                });

                await sock.sendMessage(from, { 
                    text: `⚠️ Image එක fail උනා නමුත් Text එක post උනා!\nImage Error: ${err1.message}` 
                }, { quoted: msg });

            } catch (err2) {
                // ක්‍රම දෙකම fail නම් exact error එක එවයි
                await sock.sendMessage(from, { 
                    text: `❌ Post එක සම්පූර්ණයෙන්ම Fail උනා!\n\n*Error Log:*\n\`\`\`${err2.stack || err2.message || err2}\`\`\`\n\n📌 කරුණාකර Bot අංකය Channel එකේ Admin ද සහ 'Manage Channel' permission දී ඇත්දැයි බලන්න.` 
                }, { quoted: msg });
            }
        }
    }
};

