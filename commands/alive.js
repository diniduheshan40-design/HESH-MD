// commands/alive.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ⚡ Solid & Cached Logo Finder (Memory-safe)
let cachedLogo = null;
async function getBotLogo() {
    if (cachedLogo) return cachedLogo;

    try {
        const paths = [
            path.join(__dirname, '../logo.jpg'),
            path.join(process.cwd(), 'logo.jpg'),
            path.join(process.cwd(), 'assets', 'logo.jpg')
        ];

        for (const p of paths) {
            if (fs.existsSync(p)) {
                cachedLogo = fs.readFileSync(p);
                return cachedLogo;
            }
        }
    } catch (e) {
        console.error("Logo cache error:", e.message);
    }

    // Direct Web Fallback (Buffer conversion)
    try {
        const fallbackUrl = 'https://raw.githubusercontent.com/diniduheshan40-design/HESH-MD/main/logo.jpg';
        const response = await axios.get(fallbackUrl, { responseType: 'arraybuffer', timeout: 5000 });
        cachedLogo = Buffer.from(response.data, 'binary');
        return cachedLogo;
    } catch (netErr) {
        console.error("Alive remote logo fetch failed:", netErr.message);
        return null;
    }
}

const TIMEZONE_MAP = {
    '91': 'Asia/Kolkata',
    '92': 'Asia/Karachi',
    '971': 'Asia/Dubai',
    '966': 'Asia/Riyadh',
    '974': 'Asia/Qatar',
    '60': 'Asia/Kuala_Lumpur',
    '65': 'Asia/Singapore',
    '44': 'Europe/London',
    '61': 'Australia/Sydney',
    '880': 'Asia/Dhaka',
    '39': 'Europe/Berlin',
    '49': 'Europe/Berlin',
    '33': 'Europe/Berlin'
};

const NUMBER_MAP = { '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣', '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣' };

function getEmojiTime(jid) {
    let tz = 'Asia/Colombo';
    try {
        if (jid && jid.includes('@s.whatsapp.net')) {
            const num = jid.split('@')[0].split(':')[0];
            for (const prefix in TIMEZONE_MAP) {
                if (num.startsWith(prefix)) {
                    tz = TIMEZONE_MAP[prefix];
                    break;
                }
            }
            if (num.startsWith('1') && num.length <= 12) tz = 'America/New_York';
        }

        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true
        });

        const parts = formatter.formatToParts(new Date());
        const hours = parts.find(p => p.type === 'hour')?.value || '00';
        const minutes = parts.find(p => p.type === 'minute')?.value || '00';
        const ampm = parts.find(p => p.type === 'dayPeriod')?.value.toUpperCase() || 'AM';

        const emojiHours = hours.split('').map(d => NUMBER_MAP[d] || d).join('');
        const emojiMinutes = minutes.split('').map(d => NUMBER_MAP[d] || d).join('');
        const emojiAmPm = ampm === 'PM' ? '🇵‌🇲‌' : '🇦‌🇲‌';

        return `${emojiHours} : ${emojiMinutes} ${emojiAmPm}`;
    } catch (e) {
        return "12:00 🇵‌🇲‌";
    }
}

function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

module.exports = {
    name: 'alive',
    category: 'general',
    desc: 'Check bot operational status and info',

    async execute(sock, msg, args, chatJid) {
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

        if (!targetChat) return;

        const senderJid = msg.key.participant || targetChat;

        // Instant reaction
        sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

        const pushName = msg.pushName || "User";  
        let firstName = pushName.split(/[\s_+-]+/)[0] || "User"; 
        if (firstName.length > 15) firstName = firstName.substring(0, 15);  

        const uptime = formatUptime(process.uptime());
        const emojiTime = getEmojiTime(senderJid);

        const aliveMsg = `┏━━━〔 ⚔ 𝐇𝐄𝐒𝐇𝐀𝐍-𝐌𝐃 ⚔ 〕━━━┓
┃
┃  👋 *𝗛𝗲𝘆*, ${firstName}
┃  ───────────────
┃  👑 *𝗖𝗿𝗲𝗮𝘁𝗼𝗿* ⌁ Dinidu Heshan
┃  ⏳ *𝗨𝗽𝘁𝗶𝗺𝗲*  ⌁ ${uptime}
┃  ⏰ *𝗧𝗶𝗺𝗲*    ⌁ ${emojiTime}
┃  📶 *𝗦𝘆𝘀𝘁𝗲𝗺*  ⌁ Ultra-Smooth 🟢
┃
┗━━━━━━━━━━━━━━━━━━━━━━┛

┌───「 𝗙𝗲𝗮𝘁𝘂𝗿𝗲𝘀 」───┐
│
│  ➜ *.menu*  - Main Commands
│  ➜ *.ping*  - Speed Test
│  ➜ *.owner* - Owner Details
│
└─────────────────────┘
> 🔐 *heshan ofc • all rights reserved*`;

        try {
            const logo = await getBotLogo();
            if (logo) {
                await sock.sendMessage(targetChat, {
                    image: logo,
                    caption: aliveMsg,
                    mimetype: 'image/jpeg'
                }, { quoted: msg });
                return;
            }
        } catch (err) {
            console.error("Alive Execution Error:", err.message);
        }

        // Image upload fail වුවහොත් direct plain text message එකක් යැවීම
        await sock.sendMessage(targetChat, { text: aliveMsg }, { quoted: msg }).catch((e) => {
            console.error("Alive Text Fallback Error:", e.message);
        });
    }
};

