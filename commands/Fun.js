// command/fun.js

const handler = async (m, { conn, text, command, groupMetadata }) => {
    // Target user තෝරාගැනීම (Group නම් Random සාමාජිකයෙක්, Inbox නම් අදාළ කෙනා)
    let targetJid;
    if (m.isGroup) {
        const participants = groupMetadata?.participants || [];
        const memberList = participants.filter(p => p.id !== conn.user.id);
        const randomUser = memberList[Math.floor(Math.random() * memberList.length)];
        targetJid = randomUser ? randomUser.id : m.sender;
    } else {
        targetJid = m.chat;
    }

    const targetTag = `@${targetJid.split('@')[0]}`;

    switch (command) {
        // 1. Fake IQ Test (.iq)
        case 'iq': {
            const iqScore = Math.floor(Math.random() * 160) + 40;
            let comment = '';
            if (iqScore > 130) comment = 'Albert Einstein ගෙ නෑයෙක්ද කොහෙද! 🧠⚡';
            else if (iqScore > 90) comment = 'සාමාන්‍ය මොළයක් තියෙනවා. 👍';
            else comment = 'මොළේ කුලියටවත් දීලද ඉන්නේ? 🥔😂';

            await conn.sendMessage(m.chat, {
                text: `🧠 *IQ TEST RESULT*\n\n👤 *User:* ${targetTag}\n📊 *IQ Level:* *${iqScore}*\n\n💬 *විග්‍රහය:* _${comment}_`,
                mentions: [targetJid]
            }, { quoted: m });
            break;
        }

        // 2. Fake FBI Warning (.fbi)
        case 'fbi': {
            await conn.sendMessage(m.chat, {
                text: `🚨 *FBI WARNING* 🚨\n\n🎯 *Target:* ${targetTag}\n📋 *Crime:* අධික ලෙස කම්මැලි වීම සහ නොනවත්වා online සිටීම.\n⚖️ *Status:* මෙම ගිණුම FBI විශේෂ අධීක්ෂණය යටතට පත් කෙරිණි! 🚔`,
                mentions: [targetJid]
            }, { quoted: m });
            break;
        }

        // 3. Fake Virus Scan (.scan / .virus)
        case 'virus':
        case 'scan': {
            const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

            await conn.sendMessage(m.chat, {
                text: `🔍 [SCANNING] ${targetTag} ගේ Device එක පරීක්ෂා කරමින් පවතී...`,
                mentions: [targetJid]
            }, { quoted: m });
            
            await sleep(2000);

            await conn.sendMessage(m.chat, {
                text: `⚠️ *VIRUS DETECTED!* \n\n👤 *Victim:* ${targetTag}\n📂 *Threats Found:*\n- _Trojan.ChatSpammer.apk_\n- _Worm.SingleLife.exe_\n\n💣 තත්පර 10කින් device එක auto-format වේ! 🏃‍♂️💨\n\n_(Prank එකක් හොඳේ! 😂)_`,
                mentions: [targetJid]
            }, { quoted: m });
            break;
        }

        // 4. Lie Detector (.lie)
        case 'lie': {
            const results = [
                '💯 පට්ට ඇත්ත! සත්‍යවාදී උතුමෙක්.',
                '🤥 බොරුවක්! කට ඇරියොත් කෙප්පයක්.',
                '🤔 50% ක් ඇත්ත, 50% ක් බොරු.',
                '🚨 සයිරන් වදින තරම් ලොකු පචයක්!'
            ];
            const pick = results[Math.floor(Math.random() * results.length)];
            const statement = text ? `"${text}"` : 'අන්තිමට කිව්ව කතාව';

            await conn.sendMessage(m.chat, {
                text: `🔎 *LIE DETECTOR TEST*\n\n👤 *User:* ${targetTag}\n🗣️ *ප්‍රකාශය:* ${statement}\n\n🏆 *ප්‍රතිඵලය:* *${pick}*`,
                mentions: [targetJid]
            }, { quoted: m });
            break;
        }

        // 5. Love Match (.love / .ship)
        case 'love':
        case 'ship': {
            let user1, user2;

            if (m.isGroup) {
                const participants = groupMetadata?.participants || [];
                const validMembers = participants.filter(p => p.id !== conn.user.id);
                
                if (validMembers.length < 2) {
                    return conn.sendMessage(m.chat, { text: '⚠️ Group එකේ ප්‍රමාණවත් සාමාජිකයන් නොමැත.' }, { quoted: m });
                }

                const shuffled = validMembers.sort(() => 0.5 - Math.random());
                user1 = shuffled[0].id;
                user2 = shuffled[1].id;
            } else {
                user1 = m.sender;
                user2 = m.chat;
            }

            const tag1 = `@${user1.split('@')[0]}`;
            const tag2 = `@${user2.split('@')[0]}`;
            const score = Math.floor(Math.random() * 101);

            let verdict = '';
            if (score > 80) verdict = 'සුපිරිම match එකක්! ඉක්මනටම wedding එක ගමු. 💍❤️';
            else if (score > 50) verdict = 'Shape එකක් තියෙනවා, උත්සාහ කළොත් හරි යයි. 😉';
            else verdict = 'වැඩක් නෑ සහෝ, වෙන එකක් බලමු... 💔🥲';

            await conn.sendMessage(m.chat, {
                text: `❤️ *LOVE MATCH RESULT*\n\n👩‍❤️‍👨 ${tag1}  ➕  ${tag2}\n✨ *Score:* *${score}%*\n\n💬 *Verdict:* ${verdict}`,
                mentions: [user1, user2]
            }, { quoted: m });
            break;
        }
    }
};

handler.command = ['iq', 'fbi', 'virus', 'scan', 'lie', 'love', 'ship'];
module.exports = handler;

