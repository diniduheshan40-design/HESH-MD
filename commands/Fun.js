const { cmd } = require('../command'); // ඔබේ bot එකේ path එක අනුව ('../lib/command' වෙන්නත් පුළුවන්)

// 1. IQ Test (.iq)
cmd({
    pattern: "iq",
    desc: "Fake IQ test",
    category: "fun",
    filename: __filename
},
async(conn, mek, m, { from, isGroup, groupMetadata, reply }) => {
    try {
        let targetJid;
        if (isGroup) {
            const participants = groupMetadata?.participants || [];
            const members = participants.filter(p => p.id !== conn.user.id);
            const random = members[Math.floor(Math.random() * members.length)];
            targetJid = random ? random.id : m.sender;
        } else {
            targetJid = from;
        }

        const targetTag = `@${targetJid.split('@')[0]}`;
        const iqScore = Math.floor(Math.random() * 160) + 40;
        let comment = iqScore > 130 ? 'Einstein ගෙ නෑයෙක්ද කොහෙද! 🧠⚡' : (iqScore > 90 ? 'සාමාන්‍ය මොළයක් තියෙනවා. 👍' : 'මොළේ කුලියටවත් දීලද? 🥔😂');

        await conn.sendMessage(from, {
            text: `🧠 *IQ TEST RESULT*\n\n👤 *User:* ${targetTag}\n📊 *IQ Level:* *${iqScore}*\n💬 *විග්‍රහය:* _${comment}_`,
            mentions: [targetJid]
        }, { quoted: mek });
    } catch (e) {
        reply(`Error: ${e.message}`);
    }
});

// 2. FBI Warning (.fbi)
cmd({
    pattern: "fbi",
    desc: "Fake FBI alert",
    category: "fun",
    filename: __filename
},
async(conn, mek, m, { from, isGroup, groupMetadata, reply }) => {
    try {
        let targetJid;
        if (isGroup) {
            const participants = groupMetadata?.participants || [];
            const members = participants.filter(p => p.id !== conn.user.id);
            const random = members[Math.floor(Math.random() * members.length)];
            targetJid = random ? random.id : m.sender;
        } else {
            targetJid = from;
        }

        const targetTag = `@${targetJid.split('@')[0]}`;
        await conn.sendMessage(from, {
            text: `🚨 *FBI WARNING* 🚨\n\n🎯 *Target:* ${targetTag}\n📋 *Crime:* අධික ලෙස කම්මැලි වීම සහ group එකේ නොනවත්වා online සිටීම.\n⚖️ *Status:* FBI අධීක්ෂණය යටතට පත් කෙරිණි! 🚔`,
            mentions: [targetJid]
        }, { quoted: mek });
    } catch (e) {
        reply(`Error: ${e.message}`);
    }
});

// 3. Virus Prank (.virus / .scan)
cmd({
    pattern: "virus",
    alias: ["scan"],
    desc: "Fake virus scan",
    category: "fun",
    filename: __filename
},
async(conn, mek, m, { from, isGroup, groupMetadata, reply }) => {
    try {
        let targetJid;
        if (isGroup) {
            const participants = groupMetadata?.participants || [];
            const members = participants.filter(p => p.id !== conn.user.id);
            const random = members[Math.floor(Math.random() * members.length)];
            targetJid = random ? random.id : m.sender;
        } else {
            targetJid = from;
        }

        const targetTag = `@${targetJid.split('@')[0]}`;
        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        await conn.sendMessage(from, { text: `🔍 [SCANNING] ${targetTag} ගේ Device එක පරීක්ෂා කරමින් පවතී...`, mentions: [targetJid] }, { quoted: mek });
        await sleep(2000);
        await conn.sendMessage(from, {
            text: `⚠️ *VIRUS DETECTED!* \n\n👤 *Victim:* ${targetTag}\n📂 *Threats Found:*\n- _Trojan.ChatSpammer.apk_\n- _Worm.SingleLife.exe_\n\n💣 තත්පර 10කින් device එක auto-format වේ! 🏃‍♂️💨\n\n_(Prank එකක් හොඳේ! 😂)_`,
            mentions: [targetJid]
        }, { quoted: mek });
    } catch (e) {
        reply(`Error: ${e.message}`);
    }
});

// 4. Lie Detector (.lie)
cmd({
    pattern: "lie",
    desc: "Lie detector test",
    category: "fun",
    filename: __filename
},
async(conn, mek, m, { from, isGroup, groupMetadata, q, reply }) => {
    try {
        let targetJid;
        if (isGroup) {
            const participants = groupMetadata?.participants || [];
            const members = participants.filter(p => p.id !== conn.user.id);
            const random = members[Math.floor(Math.random() * members.length)];
            targetJid = random ? random.id : m.sender;
        } else {
            targetJid = from;
        }

        const targetTag = `@${targetJid.split('@')[0]}`;
        const results = ['💯 පට්ට ඇත්ත!', '🤥 බොරුවක්! කට ඇරියොත් කෙප්පයක්.', '🤔 50% ක් ඇත්ත, 50% ක් බොරු.', '🚨 සයිරන් වදින තරම් ලොකු පචයක්!'];
        const pick = results[Math.floor(Math.random() * results.length)];
        const statement = q ? `"${q}"` : 'අන්තිමට කිව්ව කතාව';

        await conn.sendMessage(from, {
            text: `🔎 *LIE DETECTOR TEST*\n\n👤 *User:* ${targetTag}\n🗣️ *ප්‍රකාශය:* ${statement}\n🏆 *ප්‍රතිඵලය:* *${pick}*`,
            mentions: [targetJid]
        }, { quoted: mek });
    } catch (e) {
        reply(`Error: ${e.message}`);
    }
});

// 5. Love Match (.love / .ship)
cmd({
    pattern: "love",
    alias: ["ship"],
    desc: "Love match calculator",
    category: "fun",
    filename: __filename
},
async(conn, mek, m, { from, isGroup, groupMetadata, reply }) => {
    try {
        let u1, u2;
        if (isGroup) {
            const participants = groupMetadata?.participants || [];
            const members = participants.filter(p => p.id !== conn.user.id);
            if (members.length < 2) return reply('⚠️ සාමාජිකයන් ප්‍රමාණවත් නැත.');
            const shuffled = members.sort(() => 0.5 - Math.random());
            u1 = shuffled[0].id;
            u2 = shuffled[1].id;
        } else {
            u1 = m.sender;
            u2 = from;
        }

        const tag1 = `@${u1.split('@')[0]}`;
        const tag2 = `@${u2.split('@')[0]}`;
        const score = Math.floor(Math.random() * 101);
        let verdict = score > 80 ? 'සුපිරිම match එකක්! 💍❤️' : (score > 50 ? 'උත්සාහ කළොත් හරි යයි. 😉' : 'වෙන එකක් බලමු... 💔🥲');

        await conn.sendMessage(from, {
            text: `❤️ *LOVE MATCH RESULT*\n\n👩‍❤️‍👨 ${tag1}  ➕  ${tag2}\n✨ *Score:* *${score}%*\n💬 *Verdict:* ${verdict}`,
            mentions: [u1, u2]
        }, { quoted: mek });
    } catch (e) {
        reply(`Error: ${e.message}`);
    }
});

