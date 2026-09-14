module.exports = {
    name: 'menu',
    async execute(sock, msg, args, chatJid) {
        // Logo Direct URL
        const logoUrl = 'https://files.catbox.moe/a58add.jpeg';

        // මෙනූ Text එක (Formatting errors නිවැරදි කර ඇත)
        const menuText = `*🤖 HESHAN-MD BOT IS ONLINE*
_________________________________________

*╭─❭ 📥 DOWNLOAD-CMD 📥 ❭* 
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
*├◈ .ʀᴇᴘᴏʀᴛ*
*├◈ .ʙᴏᴏᴍ*
*╰──────────────────❭*

*╭──❭ 🔔 ADMIN CMD 🔔 ❭* 
*├◈ .ᴍᴏᴅᴇ*
*├◈ .ꜱᴛᴀᴛᴜꜱ*
*├◈ .ꜱᴀᴠᴇ*
*├◈ .ʙʟᴏᴄᴋ*
*├◈ .ʀᴇꜱᴛᴀʀᴛ*
*├◈ .ᴀɴᴛɪᴄᴀʟʟ*
*├◈ .ꜱᴇᴍᴅ-ꜱᴛ*
*╰──────────────────❭*

*⫷⫷⫷ \`HESHAN MD BEST BOT\` ⫸⫸⫸*`;

        try {
            // chatJid වෙත කෙලින්ම යැවීම (වෙන අයගේ chat වලදීත් 100% වැඩ කරයි)
            await sock.sendMessage(chatJid, {
                image: { url: logoUrl },
                caption: menuText,
                contextInfo: {
                    forwardingScore: 999,
                    isForwarded: true
                }
            }, { quoted: msg });
        } catch (err) {
            console.error('Error in menu command:', err);
            // Image එක load වුණේ නැතහොත් Text එක පමණක් හෝ යවයි
            await sock.sendMessage(chatJid, { text: menuText }, { quoted: msg });
        }
    }
};
