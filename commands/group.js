// commands/group.js

module.exports = {
    name: 'group',
    alias: ['kick', 'remove', 'add', 'promote', 'demote', 'mute', 'close', 'unmute', 'open', 'link', 'grouplink', 'revoke', 'resetlink', 'setname', 'setdesc'],
    category: 'group',
    desc: 'All-in-one group admin management commands',

    async execute(sock, msg, args, chatJid) {
        const from = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const reply = async (text) => {
            return await sock.sendMessage(from, { text }, { quoted: msg });
        };

        // 1. Group Chat එකක්දැයි පරීක්ෂා කිරීම
        const isGroup = from.endsWith('@g.us');
        if (!isGroup) return reply('❌ මෙම විධානය භාවිතා කළ හැක්කේ Groups තුළ පමණි.');

        try {
            // 2. Command නම ලබා ගැනීම
            const rawText = msg.message?.conversation || 
                            msg.message?.extendedTextMessage?.text || 
                            msg.message?.imageMessage?.caption || 
                            msg.message?.videoMessage?.caption || "";
            
            const command = rawText.trim().split(/\s+/)[0].slice(1).toLowerCase();

            // 3. Metadata සහ Admin අවසර පරීක්ෂාව
            const groupMetadata = await sock.groupMetadata(from);
            const participants = groupMetadata.participants || [];

            const sender = msg.key.participant || from;

            const botId = sock.user.id.includes(':') 
                ? sock.user.id.split(':')[0] + '@s.whatsapp.net' 
                : sock.user.id.split('@')[0] + '@s.whatsapp.net';

            const groupAdmins = participants
                .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                .map(p => p.id);

            const isBotAdmin = groupAdmins.includes(botId);
            const isAdmin = groupAdmins.includes(sender);

            // 4. Mention / Quoted User හඳුනාගැනීම
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const getTargetUser = () => {
                if (contextInfo?.participant) return contextInfo.participant;
                if (contextInfo?.mentionedJid && contextInfo.mentionedJid.length > 0) return contextInfo.mentionedJid[0];
                if (args[0]) {
                    let cleanNum = args[0].replace(/[^0-9]/g, '');
                    if (cleanNum.length >= 9) return cleanNum + '@s.whatsapp.net';
                }
                return null;
            };

            const textAfterCmd = args.join(' ').trim();

            // 5. Commands Switch
            switch (command) {
                // --- KICK / REMOVE ---
                case 'kick':
                case 'remove': {
                    if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                    if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල ලබා දෙන්න.');

                    const target = getTargetUser();
                    if (!target) return reply('කරුණාකර ඉවත් කළ යුතු සාමාජිකයා mention කරන්න හෝ message එකකට reply කරන්න.');
                    if (target === botId) return reply('මට මාවම ඉවත් කරගත නොහැක.');
                    if (groupAdmins.includes(target)) return reply('⚠️ Group Admin වරුන් ඉවත් කළ නොහැක.');

                    await sock.groupParticipantsUpdate(from, [target], 'remove');
                    return reply('✅ සාමාජිකයා සාර්ථකව ඉවත් කරන ලදී.');
                }

                // --- ADD ---
                case 'add': {
                    if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                    if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල ලබා දෙන්න.');

                    if (!args[0]) return reply('කරුණාකර එකතු කළ යුතු අංකය ලබා දෙන්න (උදා: .add 947xxxxxxxx).');
                    let targetNum = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';

                    const res = await sock.groupParticipantsUpdate(from, [targetNum], 'add');
                    if (res[0] && res[0].status === '403') {
                        return reply('⚠️ සාමාජිකයාගේ Privacy Settings නිසා direct add කළ නොහැක. Invite link එකක් යවන්න.');
                    }
                    return reply('✅ සාමාජිකයා එකතු කරන ලදී.');
                }

                // --- PROMOTE ---
                case 'promote': {
                    if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                    if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල ලබා දෙන්න.');

                    const target = getTargetUser();
                    if (!target) return reply('Admin කිරීමට අවශ්‍ය පුද්ගලයා mention කරන්න හෝ reply කරන්න.');
                    if (groupAdmins.includes(target)) return reply('මෙම සාමාජිකයා දැනටමත් Admin කෙනෙකි.');

                    await sock.groupParticipantsUpdate(from, [target], 'promote');
                    return reply('✅ සාර්ථකව Admin තනතුර ලබා දෙන ලදී.');
                }

                // --- DEMOTE ---
                case 'demote': {
                    if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                    if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල ලබා දෙන්න.');

                    const target = getTargetUser();
                    if (!target) return reply('Admin තනතුර ඉවත් කිරීමට අවශ්‍ය පුද්ගලයා mention කරන්න හෝ reply කරන්න.');
                    if (!groupAdmins.includes(target)) return reply('මෙම සාමාජිකයා Admin කෙනෙකු නොවේ.');

                    await sock.groupParticipantsUpdate(from, [target], 'demote');
                    return reply('✅ Admin තනතුර ඉවත් කරන ලදී.');
                }

                // --- MUTE (Close Group) ---
                case 'mute':
                case 'close': {
                    if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                    if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල ලබා දෙන්න.');

                    await sock.groupSettingUpdate(from, 'announcement');
                    return reply('🔒 Group එක Close කරන ලදී. (Admin පමණි)');
                }

                // --- UNMUTE (Open Group) ---
                case 'unmute':
                case 'open': {
                    if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                    if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල ලබා දෙන්න.');

                    await sock.groupSettingUpdate(from, 'not_announcement');
                    return reply('🔓 Group එක Open කරන ලදී. (සියලු සාමාජිකයන්ට)');
                }

                // --- GET INVITE LINK ---
                case 'link':
                case 'grouplink': {
                    if (!isBotAdmin) return reply('⚠️ Link එක ලබා ගැනීමට බොට්ට Admin බලතල තිබිය යුතුය.');

                    const code = await sock.groupInviteCode(from);
                    return reply(`🔗 *Group Link:*\nhttps://chat.whatsapp.com/${code}`);
                }

                // --- REVOKE / RESET LINK ---
                case 'revoke':
                case 'resetlink': {
                    if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                    if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල තිබිය යුතුය.');

                    await sock.groupRevokeInvite(from);
                    const newCode = await sock.groupInviteCode(from);
                    return reply(`🔄 පැරණි Link එක Reset කරන ලදී.\n\n🔗 *නව Link එක:*\nhttps://chat.whatsapp.com/${newCode}`);
                }

                // --- SET GROUP NAME ---
                case 'setname': {
                    if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                    if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල තිබිය යුතුය.');
                    if (!textAfterCmd) return reply('කරුණාකර Group එකට තැබීමට අවශ්‍ය නම ලබා දෙන්න.');

                    await sock.groupUpdateSubject(from, textAfterCmd);
                    return reply('✅ Group නම සාර්ථකව වෙනස් කරන ලදී.');
                }

                // --- SET GROUP DESCRIPTION ---
                case 'setdesc': {
                    if (!isAdmin) return reply('⚠️ ඔබ Group Admin කෙනෙකු විය යුතුය.');
                    if (!isBotAdmin) return reply('⚠️ බොට්ට Admin බලතල තිබිය යුතුය.');
                    if (!textAfterCmd) return reply('කරුණාකර නව Description එක ලබා දෙන්න.');

                    await sock.groupUpdateDescription(from, textAfterCmd);
                    return reply('✅ Group Description එක සාර්ථකව වෙනස් කරන ලදී.');
                }
            }
        } catch (e) {
            console.error("Group Command Error:", e);
            reply('❌ Error: ' + e.message);
        }
    }
};

