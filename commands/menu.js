module.exports = {
    name: 'menu',
    async execute(sock, msg, args, sender) {
        // Logo එකේ Direct Link එක (ඔයා කැමති එකකට මෙතනින් මාරු කරන්න)
        const logoUrl = 'https://files.catbox.moe/a58add.jpeg';

        // මෙනූ එකේ text එක
        const menuText = `*🤖 HESHAN-MD BOT IS ONLINE*
_________________________________________

*╭─❭ 📥DOWNLOAD-CMD📥 ❭* 
*├◈ .ғʙ*
*├◈ .ᴠɪᴅᴇᴏ*
*├◈ .sᴏɴɢ*
*├◈ .ᴛɪᴋᴛᴏᴋ*
*╰──────────────────❭*
*╭──❭ 🔎 SEARCH-CMD 🔍 ❭* 
*├◈ .ꜱʀᴇᴘᴏ*
*├◈ .ɴᴘᴍ*
*├◈ .ɪᴍɢɢ*
*╰──────────────────❭*
*╭──❭ 👨‍💻 USER-CMD 👨‍💻 ❭* 
*├◈ .ᴏᴡɴᴇʀ*
*├◈ .ᴘɪɴɢ*
*├◈ .ꜱʏꜱᴛᴇᴍ*
*├◈ .ᴀʟɪᴠᴇ*
*├◈ .*ʀᴇᴘᴏʀᴛ*
*├◈ .ʙᴏᴏᴍ*
*├◈ .ᴏᴡɴᴇʀ*
*├◈ .ᴀʟɪᴠᴇ*
*╰──────────────────❭*
*╭──❭ 🔔 ADMIN CMD 🔔 ❭* 
*├◈ .ᴍᴏᴅᴇ*
*├◈ .ꜱᴛᴀᴛᴜꜱ*
*├◈ .ꜱᴀᴠᴇ*
*├◈ .ʙʟᴏᴄᴋ*
*├◈ .*ʀᴇᴘᴏʀᴛ*
*├◈ .ʙᴏᴏᴍ*
*├◈ .ʀᴇꜱᴛᴀʀᴛ*
*├◈ .ᴀɴᴛɪᴄᴀʟʟ*
*├◈ .ꜱᴇᴍᴅ-ꜱᴛ*
*╰──────────────────❭*

*⫷⫷⫷ \`HESHAN MD BEST BOT\` ⫸⫸⫸*`;

        // Newsletter / Channel forwarding style එකත් එක්ක Photo එක යැවීම
        await sock.sendMessage(sender, {
            image: { url: logoUrl },
            caption: menuText,
            contextInfo: {
                quotedMessage: msg.message,
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '',
                    newsletterName: 'HESHAN MD FORWARD',
                    serverMessageId: 143
                }
            }
        }, { quoted: msg });
    }
};

