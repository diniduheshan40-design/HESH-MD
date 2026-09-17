const { cmd } = require('../command'); // ඔබේ බොට්ගේ command loader එක අනුව path එක (උදා: require('../framework') ආදී විය හැක)

cmd({
    pattern: "group",
    alias: ["kick", "remove", "add", "promote", "demote", "mute", "close", "unmute", "open", "link", "grouplink", "revoke", "resetlink", "setname", "setdesc"],
    desc: "All-in-one group admin management commands",
    category: "group",
    filename: __filename
},
async (sock, m, chatUpdate, { from, q, args, command, reply, isGroup, sender, botNumber }) => {
    try {
        // 1. Group එකක්ද යන්න තහවුරු කිරීම
        if (!isGroup) return reply('❌ මෙම විධානය භාවිත කළ හැක්කේ Groups තුළ පමණි.');

        // 2. Metadata සහ Permissions ලබා ගැනීම
        const groupMetadata = await sock.groupMetadata(from);
        const participants = groupMetadata.participants || [];

        const botId = sock.user.id.includes(':') 
            ? sock.user.id.split(':')[0] + '@s.whatsapp.net' 
            : sock.user.id.split('@')[0] + '@s.whatsapp.net';

        const groupAdmins = participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id);

        const isBotAdmin = groupAdmins.includes(botId);
        const isAdmin = groupAdmins.includes(sender);

        // Target User හඳුනාගැනීම (Mention / Quoted / Number)
        const getTargetUser = () => {
            if (m.quoted && m.quoted.sender) return m.quoted.sender;
            if (m.mentionedJid && m.mentionedJid.length > 0) return m.mentionedJid[0];
            if (args[0]) {
                let cleanNumber = args[0].replace(/[^0-9]/g, '');
                if (cleanNumber.length >= 10) return cleanNumber + '@s.whatsapp.net';
            }
            return null;
        };

        // 3. විධානය අනුව ක්‍රියාත්මක වීම
        switch (command) {
            // --- KICK / REMOVE ---
            case 'kick':
            case 'remove': {
                if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                if (!isBotAdmin) return reply('⚠️ මට සාමාජිකයන් ඉවත් කිරීමට Admin බලතල දෙන්න.');

                const target = getTargetUser();
                if (!target) return reply('කරුණාකර ඉවත් කළ යුතු පුද්ගලයා mention කරන්න හෝ message එකකට reply කරන්න.');
                if (target === botId) return reply('මට මාවම ඉවත් කරගත නොහැක.');
                if (groupAdmins.includes(target)) return reply('⚠️ Group Admin වරුන් ඉවත් කළ නොහැක.');

                await sock.groupParticipantsUpdate(from, [target], 'remove');
                return reply('✅ සාමාජිකයා සාර්ථකව ඉවත් කරන ලදී.');
            }

            // --- ADD MEMBER ---
            case 'add': {
                if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල අවශ්‍යයි.');

                if (!args[0]) return reply('කරුණාකර එකතු කිරීමට අංකය ලබා දෙන්න (උදා: .add 947xxxxxxxx).');
                let number = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';

                const res = await sock.groupParticipantsUpdate(from, [number], 'add');
                if (res[0] && res[0].status === '403') {
                    return reply('⚠️ Privacy Settings නිසා direct add කළ නොහැක. Invite link එකක් යවන්න.');
                }
                return reply('✅ සාමාජිකයා සාර්ථකව එකතු කරන ලදී.');
            }

            // --- PROMOTE ---
            case 'promote': {
                if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල නැත.');

                const target = getTargetUser();
                if (!target) return reply('Admin කිරීමට අවශ්‍ය පුද්ගලයා mention කරන්න හෝ reply කරන්න.');
                if (groupAdmins.includes(target)) return reply('මෙම පුද්ගලයා දැනටමත් Admin කෙනෙකි.');

                await sock.groupParticipantsUpdate(from, [target], 'promote');
                return reply('✅ සාර්ථකව Admin තනතුර ලබා දෙන ලදී.');
            }

            // --- DEMOTE ---
            case 'demote': {
                if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල නැත.');

                const target = getTargetUser();
                if (!target) return reply('Admin තනතුර ඉවත් කිරීමට අවශ්‍ය පුද්ගලයා mention කරන්න හෝ reply කරන්න.');
                if (!groupAdmins.includes(target)) return reply('මෙම පුද්ගලයා Admin කෙනෙකු නොවේ.');

                await sock.groupParticipantsUpdate(from, [target], 'demote');
                return reply('✅ Admin තනතුර සාර්ථකව ඉවත් කරන ලදී.');
            }

            // --- MUTE GROUP ---
            case 'mute':
            case 'close': {
                if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල ලබා දෙන්න.');

                await sock.groupSettingUpdate(from, 'announcement');
                return reply('🔒 Group එක සාර්ථකව Close කරන ලදී (Admins Only).');
            }

            // --- UNMUTE GROUP ---
            case 'unmute':
            case 'open': {
                if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල ලබා දෙන්න.');

                await sock.groupSettingUpdate(from, 'not_announcement');
                return reply('🔓 Group එක සාර්ථකව Open කරන ලදී (All Members).');
            }

            // --- GROUP INVITE LINK ---
            case 'link':
            case 'grouplink': {
                if (!isBotAdmin) return reply('⚠️ Group Link ලබා ගැනීමට බොට්ට Admin බලතල අවශ්‍යයි.');

                const code = await sock.groupInviteCode(from);
                return reply(`🔗 *Group Link:*\nhttps://chat.whatsapp.com/${code}`);
            }

            // --- RESET / REVOKE LINK ---
            case 'revoke':
            case 'resetlink': {
                if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල අවශ්‍යයි.');

                await sock.groupRevokeInvite(from);
                const newCode = await sock.groupInviteCode(from);
                return reply(`🔄 Link එක Reset කරන ලදී.\n\n🔗 *නව Link එක:*\nhttps://chat.whatsapp.com/${newCode}`);
            }

            // --- SET NAME ---
            case 'setname': {
                if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල අවශ්‍යයි.');
                if (!q) return reply('කරුණාකර Group එකට දැමීමට අවශ්‍ය නව නම ලබා දෙන්න.');

                await sock.groupUpdateSubject(from, q);
                return reply('✅ Group එකේ නම වෙනස් කරන ලදී.');
            }

            // --- SET DESCRIPTION ---
            case 'setdesc': {
                if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල අවශ්‍යයි.');
                if (!q) return reply('කරුණාකර නව Description එක ලබා දෙන්න.');

                await sock.groupUpdateDescription(from, q);
                return reply('✅ Group Description එක වෙනස් කරන ලදී.');
            }
        }
    } catch (e) {
        reply('❌ Error: ' + e.message);
    }
});

