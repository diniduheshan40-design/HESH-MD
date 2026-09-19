// commands/getdp.js
module.exports = {
    name: 'getdp',
    alias: ['pp', 'userdp'],
    category: 'tools',
    desc: 'Get high quality profile picture of a user',

    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        try {
            let targetJid;
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;

            if (contextInfo?.participant) {
                targetJid = contextInfo.participant;
            } else if (contextInfo?.mentionedJid?.length) {
                targetJid = contextInfo.mentionedJid[0];
            } else if (args[0] && args[0].replace(/[^0-9]/g, '').length > 7) {
                targetJid = `${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net`;
            } else {
                return await sock.sendMessage(targetChat, {
                    text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර Profile Picture එක ලබාගැනීමට අවශ්‍ය කෙනාව Mention කරන්න හෝ ඔහුගේ මැසේජ් එකකට Reply කරන්න!*${DEFAULT_FOOTER}`
                }, { quoted: msg });
            }

            // ⚡ LID to Real Phone JID Resolution (WhatsApp latest update compatibility)
            if (targetJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
                try {
                    const resolved = await sock.signalRepository.lidToJid(targetJid);
                    if (resolved) targetJid = resolved;
                } catch (e) {}
            }

            sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

            // High Quality Profile Picture fetch
            let dpUrl;
            try {
                dpUrl = await sock.profilePictureUrl(targetJid, 'image');
            } catch (e) {
                sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, {
                    text: `❌ *මෙම පරිශීලකයාගේ Profile Picture එක ලබාගත නොහැක.* (පින්තූරයක් දමා නැත හෝ Privacy සීමා කර ඇත)${DEFAULT_FOOTER}`
                }, { quoted: msg });
            }

            const cleanNum = targetJid.split('@')[0].split(':')[0];

            await sock.sendMessage(targetChat, {
                image: { url: dpUrl },
                caption: `*👤 𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗣𝗥𝗢𝗙𝗜𝗟𝗘 𝗣𝗜𝗖𝗧𝗨𝗥𝗘 👤*\n\n📌 *User:* @${cleanNum}${DEFAULT_FOOTER}`,
                mentions: [targetJid]
            }, { quoted: msg });

            sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('GetDP Error:', err.message);
            sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, {
                text: `❌ *දෝෂයක් ඇති විය:* ${err.message}${DEFAULT_FOOTER}`
            }, { quoted: msg });
        }
    }
};
