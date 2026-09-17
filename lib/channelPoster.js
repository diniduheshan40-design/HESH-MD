// lib/channelPoster.js
const { generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const { fetchTikTokMedia } = require('./tiktokHelper');

async function sendTikTokVideoToChannel(sock, channelJid, query = 'mrbeast') {
    try {
        console.log(`⏳ [CHANNEL-POSTER] Fetching TikTok for ${query}...`);
        const mediaData = await fetchTikTokMedia(query);

        if (!mediaData || !mediaData.buffer) {
            throw new Error('TikTok Video එක download කර ගැනීමට නොහැකි විය.');
        }

        const caption = `┏━━━〔 🎬 𝗧𝗜𝗞𝗧𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 〕━━━┓\n` +
                        `┃\n` +
                        `┃  📌 *Title* ⌁ ${mediaData.title}\n` +
                        `┃  👤 *Author* ⌁ ${mediaData.author}\n` +
                        `┃  ⏰ *Auto Post* ⌁ Every 5 Mins\n` +
                        `┃\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                        `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

        // 1. Baileys Media Node Generate කිරීම
        const media = await generateWAMessageContent({
            video: mediaData.buffer,
            caption: caption,
            mimetype: 'video/mp4'
        }, { upload: sock.waUploadToServer });

        // 2. Newsletter Content එක සකස් කිරීම
        const newsletterMsg = generateWAMessageFromContent(channelJid, {
            videoMessage: media.videoMessage
        }, {});

        // 3. Relay Message මඟින් Channel එකට Send කිරීම
        const response = await sock.relayMessage(channelJid, newsletterMsg.message, {
            messageId: newsletterMsg.key.id
        });

        console.log(`✅ [CHANNEL-POSTER] Video posted successfully:`, response || newsletterMsg.key.id);
        return { success: true, id: newsletterMsg.key.id };

    } catch (error) {
        console.error(`❌ [CHANNEL-POSTER-ERROR]:`, error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { sendTikTokVideoToChannel };

