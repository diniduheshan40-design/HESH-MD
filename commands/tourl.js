const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: "tourl",
    alias: ["url"],
    description: "Generate a permanent URL for any media, sticker, document, or text",
    category: "utility",

    run: async (context) => {
        return module.exports.execute(context);
    },

    execute: async (context) => {
        try {
            const conn = context.conn || context.sock;
            const from = context.from || context.senderJid;
            const mek = context.mek || context.msg;
            const args = context.args || [];

            if (!conn || !from || !mek) return;

            const messageContent = mek.message?.ephemeralMessage?.message || 
                                   mek.message?.viewOnceMessage?.message || 
                                   mek.message?.viewOnceMessageV2?.message || 
                                   mek.message;
            
            const quoted = messageContent?.extendedTextMessage?.contextInfo?.quotedMessage || 
                           messageContent?.imageMessage?.contextInfo?.quotedMessage || 
                           messageContent?.videoMessage?.contextInfo?.quotedMessage ||
                           messageContent?.audioMessage?.contextInfo?.quotedMessage ||
                           messageContent?.documentMessage?.contextInfo?.quotedMessage ||
                           messageContent?.stickerMessage?.contextInfo?.quotedMessage;

            // Direct Media check (කමාන්ඩ් එකත් එක්කම ෆොටෝ/වීඩියෝ එකක් එව්වොත්)
            const isDirectMedia = messageContent?.imageMessage || 
                                  messageContent?.videoMessage || 
                                  messageContent?.audioMessage || 
                                  messageContent?.documentMessage || 
                                  messageContent?.stickerMessage;

            let buffer;
            let fileName = "file.bin";

            await conn.sendMessage(from, { react: { text: '🔄', key: mek.key } });

            // 1. Media එකක් (Photo/Video/Audio/Doc/Sticker) Reply කරලා හෝ Direct එව්වොත්
            if (isDirectMedia || (quoted && (quoted.imageMessage || quoted.videoMessage || quoted.audioMessage || quoted.documentMessage || quoted.stickerMessage))) {
                
                let targetMsg = isDirectMedia ? mek : { message: quoted };
                let msgRef = isDirectMedia ? messageContent : quoted;

                if (msgRef.imageMessage) fileName = "image.png";
                else if (msgRef.videoMessage) fileName = "video.mp4";
                else if (msgRef.audioMessage) fileName = "audio.mp3";
                else if (msgRef.documentMessage) fileName = msgRef.documentMessage.fileName || "document.file";
                else if (msgRef.stickerMessage) fileName = "sticker.webp";

                buffer = await downloadMediaMessage(
                    targetMsg,
                    'buffer',
                    {},
                    { logger: console }
                );
            } 
            // 2. Text එකක් Reply කරලා හෝ Command එකත් එක්ක ගහලා එව්වොත්
            else if (args.length > 0 || (quoted && (quoted.conversation || quoted.extendedTextMessage?.text))) {
                const textData = args.length > 0 ? args.join(" ") : (quoted.conversation || quoted.extendedTextMessage?.text);
                
                // Text එක .txt ෆයිල් එකක් බවට හැරවීම (Buffer conversion)
                buffer = Buffer.from(textData, 'utf-8');
                fileName = "text.txt";
            } 
            // 3. මුකුත් දුන්නේ නැත්නම්
            else {
                return await conn.sendMessage(from, { text: "⚠️ *Usage:*\n.tourl <text>\n\nOr reply to any Image, Video, Voice, Document, Sticker, or Text with `.tourl`" }, { quoted: mek });
            }

            if (!buffer) {
                return await conn.sendMessage(from, { text: "❌ Failed to extract content." }, { quoted: mek });
            }

            await conn.sendMessage(from, { text: "📥 Uploading to cloud server..." }, { quoted: mek });

            // 4. Catbox (Permanent CDN) එකට Upload කිරීම
            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', buffer, { filename: fileName });

            let uploadRes;
            try {
                uploadRes = await axios.post('https://catbox.moe/user/api.php', form, { 
                    headers: form.getHeaders(),
                    timeout: 30000 
                });
            } catch (err) {
                console.error("Catbox Upload Error:", err.message);
                return await conn.sendMessage(from, { text: "❌ Uploading to Catbox failed." }, { quoted: mek });
            }

            // 5. Success වූ පසු Redirect URL එක සෑදීම සහ Chat එකට යැවීම
            if (uploadRes.data && uploadRes.data.startsWith('http')) {
                const uploadedUrl = uploadRes.data;
                let finalUrl = uploadedUrl; // Default එක විදිහට මුල් ලින්ක් එක තියාගන්නවා

                // 🟢 6. url.devofc.top හරහා Short Link එක සෑදීම (POST ක්‍රමයට JSON යැවීම)
                try {
                    await conn.sendMessage(from, { text: "🔗 Generating Secure Link..." }, { quoted: mek });
                    
                    const shortRes = await axios.post('https://url.devofc.top/api/shorten', 
                        { url: uploadedUrl }, 
                        { headers: { 'Content-Type': 'application/json' } }
                    );
                    
                    // API එකෙන් එන ID එක අරගෙන Short Link එක හැදීම
                    if (shortRes.data && shortRes.data.id) {
                        finalUrl = `https://url.devofc.top/${shortRes.data.id}`;
                    }
                } catch (shortErr) {
                    console.error("URL Shortener Failed:", shortErr.message);
                    // Short API එක අවුල් ගියොත් Original Catbox Link එකම යවනවා (Safe Fallback)
                }

                const captionText = `✅ *URL Generated Successfully!*\n> 🔗 *Link:* ${finalUrl}\n\n> </> 𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 𝗛𝗘𝗦𝗛𝗔𝗡 𝗠𝗗`;
                
                await conn.sendMessage(from, { text: captionText }, { quoted: mek });
                await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            } else {
                return await conn.sendMessage(from, { text: "❌ Failed to upload file to cloud." }, { quoted: mek });
            }

        } catch (err) {
            console.error("TOURL ERROR:", err);
            const conn = context?.conn || context?.sock;
            const from = context?.from || context?.senderJid;
            const mek = context?.mek || context?.msg;
            if (conn && from) {
                await conn.sendMessage(from, { text: `❌ Error occurred: ${err.message}` }, { quoted: mek });
            }
        }
    }
};
