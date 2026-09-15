module.exports = {
    name: 'getdp',
    alias: ['pp', 'userdp'],
    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';

        try {
            // Mention කරපු කෙනා හෝ Reply කරපු කෙනාගේ JID එක ලබා ගැනීම
            let targetJid;
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo;

            if (quotedMsg?.participant) {
                targetJid = quotedMsg.participant;
            } else if (quotedMsg?.mentionedJid?.length) {
                targetJid = quotedMsg.mentionedJid[0];
            } else if (args[0] && args[0].replace(/[^0-9]/g, '').length > 7) {
                targetJid = `${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net`;
            } else {
                return await sock.sendMessage(chatJid, {
                    text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර Profile Picture එක ලබාගැනීමට අවශ්‍ය කෙනාව Mention කරන්න හෝ ඔහුගේ මැසේජ් එකකට Reply කරන්න!*${DEFAULT_FOOTER}`
                }, { quoted: msg });
            }

            await sock.sendMessage(chatJid, { react: { text: '⏳', key: msg.key } });

            // WhatsApp වෙතින් High Quality Profile Picture එක ලබා ගැනීම
            let dpUrl;
            try {
                dpUrl = await sock.profilePictureUrl(targetJid, 'image');
            } catch (e) {
                await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
                return await sock.sendMessage(chatJid, {
                    text: `❌ *මෙම පරිශීලකයාගේ Profile Picture එක ලබාගත නොහැක.* (පින්තූරයක් දමා නැත හෝ Privacy සීමා කර ඇත)${DEFAULT_FOOTER}`
                }, { quoted: msg });
            }

            await sock.sendMessage(chatJid, {
                image: { url: dpUrl },
                caption: `*👤 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗣𝗥𝗢𝗙𝗜𝗟𝗘 𝗣𝗜𝗖𝗧𝗨𝗥𝗘 👤*\n\n📌 *User:* @${targetJid.split('@')[0]}${DEFAULT_FOOTER}`,
                mentions: [targetJid]
            }, { quoted: msg });

            await sock.sendMessage(chatJid, { react: { text: '✅', key: msg.key } });

        } catch (err) {
            console.error('GetDP Error:', err.message);
            await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(chatJid, {
                text: `❌ *දෝෂයක් ඇති විය:* ${err.message}${DEFAULT_FOOTER}`
            }, { quoted: msg });
        }
    }
};

