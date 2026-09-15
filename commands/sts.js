const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: "autostatus",
    category: "tools",
    desc: "Auto send status to inbox on specific emoji reaction",
    async run({ conn, m }) {
        try {
            // Trigger වන Emoji List එක
            const allowedEmojis = ['😁', '🙂', '🥰', '❤️', '😂'];

            // මැසේජ් එකේ තියෙන්නේ අපේ ඉමෝජි එකක්ද සහ ඒක Reply එකක්ද කියා බැලීම
            let text = m.text ? m.text.trim() : '';
            if (!allowedEmojis.includes(text)) return;

            // Quoted මැසේජ් එකක් තියෙනවද සහ ඒක Status එකක්ද බැලීම
            if (!m.quoted) return;
            
            // Status එකක් හඳුනාගන්නේ broadcast JID එකෙන් ('status@broadcast')
            let isStatus = m.quoted.chat === 'status@broadcast';
            if (!isStatus) return;

            let quotedMsg = m.quoted.message;
            let type = Object.keys(quotedMsg)[0];

            // Image හෝ Video නම් Download කිරීම
            if (type === 'imageMessage' || type === 'videoMessage') {
                let mediaType = type === 'imageMessage' ? 'image' : 'video';
                let stream = await downloadContentFromMessage(quotedMsg[type], mediaType);
                let buffer = Buffer.from([]);
                
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                let caption = quotedMsg[type].caption || "";
                let senderNumber = m.quoted.sender.split('@')[0];

                // බොට් භාවිතා කරන පුද්ගලයාගේ Inbox (DM) එකට Media එක යැවීම
                let targetChat = m.sender; // කමාන්ඩ් එක දැමූ කෙනාගේ inbox එකට

                if (type === 'imageMessage') {
                    await conn.sendMessage(targetChat, {
                        image: buffer,
                        caption: `📥 *Status Downloaded!*\n👤 *From:* +${senderNumber}\n${caption ? `📝 *Caption:* ${caption}` : ''}`
                    });
                } else {
                    await conn.sendMessage(targetChat, {
                        video: buffer,
                        caption: `📥 *Status Downloaded!*\n👤 *From:* +${senderNumber}\n${caption ? `📝 *Caption:* ${caption}` : ''}`
                    });
                }

                // සාර්ථක වූ බවට reaction එකක් දැමීම
                await m.react('✅');
            }

        } catch (err) {
            console.error("AutoStatus Error:", err);
        }
    }
};

