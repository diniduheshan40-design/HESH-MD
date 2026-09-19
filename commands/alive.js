// commands/alive.js
const fs = require('fs');
const path = require('path');

// ⚡ 100% Solid & Cached Logo Finder (menu.js එකේ ක්‍රමයටම buffer cache සහිතව)
let cachedLogo = null;
function getBotLogo() {
    if (cachedLogo) return cachedLogo;

    try {
        // 1. commands folder එකෙන් එළියේ තියෙන logo.jpg කියවීම
        const localLogoPath = path.join(__dirname, '../logo.jpg');
        if (fs.existsSync(localLogoPath)) {
            cachedLogo = fs.readFileSync(localLogoPath);
            return cachedLogo;
        }

        // 2. Root එකේ බැලීම
        const rootPath = path.join(process.cwd(), 'logo.jpg');
        if (fs.existsSync(rootPath)) {
            cachedLogo = fs.readFileSync(rootPath);
            return cachedLogo;
        }

        // 3. Assets folder එකේ බැලීම
        const assetsLogoPath = path.join(process.cwd(), 'assets', 'logo.jpg');
        if (fs.existsSync(assetsLogoPath)) {
            cachedLogo = fs.readFileSync(assetsLogoPath);
            return cachedLogo;
        }
    } catch (e) {}

    // 4. GitHub එකේ තියෙන Direct Raw Image Link එක (කවදාවත් fail නොවේ)
    return { url: 'https://raw.githubusercontent.com/diniduheshan40-design/HESH-MD/main/logo.jpg' };
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

// Memory leaks වළක්වා ගැනීමට active sessions map එකක්
const activeAlivePrompts = new Map();

const triggerCommand = async (cmdName, sock, replyMsg) => {
    try {
        const cmdPath = path.join(__dirname, `${cmdName}.js`);
        if (fs.existsSync(cmdPath)) {
            const cmdModule = require(cmdPath);
            const remoteJid = replyMsg.key.remoteJid;

            const safeReply = async (content) => {
                const payload = typeof content === 'string' ? { text: content } : content;
                return await sock.sendMessage(remoteJid, payload, { quoted: replyMsg });
            };

            const executor = cmdModule.execute || cmdModule.run || cmdModule;
            if (typeof executor === 'function') {
                await executor(sock, replyMsg, [], remoteJid, safeReply, { isOwner: true });
            }
        }
    } catch (e) {
        console.error(`❌ Error triggering ${cmdName}:`, e.message);
    }
};

module.exports = {
    name: 'alive',
    category: 'general',
    desc: 'Check bot operational status and info',

    async execute(sock, msg, args, chatJid) {
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

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

┌───「 𝗥𝗲𝗽𝗹𝘆 𝗡𝘂𝗺𝗯𝗲𝗿 」───┐
│
│  [1] ➜ 📜 𝗠𝗮𝗶𝗻 𝗠𝗲𝗻𝘂
│  [2] ➜ ⚡ 𝗣𝗶𝗻𝗴 / 𝗦𝗽𝗲𝗲𝗱
│  [3] ➜ 👑 𝗢𝘄𝗻𝗲𝗿 𝗜𝗻𝗳𝗼
│
└────────────────────────┘
> 🔐 *heshan ofc • all rights reserved*`;

        try {
            const logo = getBotLogo();

            const sentMsg = await sock.sendMessage(targetChat, {
                image: logo,
                caption: aliveMsg,
                mimetype: 'image/jpeg'
            }, { quoted: msg });

            const stanzaId = sentMsg?.key?.id;
            if (!stanzaId) return;

            // පරණ duplicate listeners ඉවත් කිරීම
            if (activeAlivePrompts.has(targetChat)) {
                const prev = activeAlivePrompts.get(targetChat);
                clearTimeout(prev.timeout);
                sock.ev.off('messages.upsert', prev.listener);
            }

            const replyListener = async (m) => {  
                try {  
                    const replyMsg = m.messages?.[0];  
                    if (!replyMsg || !replyMsg.message || replyMsg.key.fromMe) return; 

                    const replyChat = replyMsg.key.remoteJid;
                    if (replyChat !== targetChat) return;

                    let msgContent = replyMsg.message;
                    if (msgContent.ephemeralMessage) msgContent = msgContent.ephemeralMessage.message;
                    if (msgContent.viewOnceMessage) msgContent = msgContent.viewOnceMessage.message;

                    const msgContext = msgContent?.extendedTextMessage?.contextInfo;
                    if (!msgContext || msgContext.stanzaId !== stanzaId) return;

                    let replyText = msgContent.conversation || 
                                    msgContent.extendedTextMessage?.text || 
                                    "";

                    replyText = replyText.trim().replace(/[\[\].]/g, '');

                    if (["1", "2", "3"].includes(replyText)) {
                        sock.ev.off('messages.upsert', replyListener);
                        if (activeAlivePrompts.has(targetChat)) {
                            clearTimeout(activeAlivePrompts.get(targetChat).timeout);
                            activeAlivePrompts.delete(targetChat);
                        }

                        if (replyText === "1") {  
                            sock.sendMessage(replyChat, { react: { text: '📜', key: replyMsg.key } }).catch(() => {});  
                            await triggerCommand('menu', sock, replyMsg);
                        } else if (replyText === "2") {  
                            sock.sendMessage(replyChat, { react: { text: '⚡', key: replyMsg.key } }).catch(() => {});
                            await triggerCommand('ping', sock, replyMsg);
                        } else if (replyText === "3") {  
                            sock.sendMessage(replyChat, { react: { text: '👑', key: replyMsg.key } }).catch(() => {});
                            const ownerDetails = `*👑 HESHAN-MD OWNER INFO*\n\n` +
                                                 `*• Name:* Dinidu Heshan\n` +
                                                 `*• Status:* Active\n` +
                                                 `*• Contact:* wa.me/94719845166\n\n` +
                                                 `> 🔐 *heshan ofc • all rights reserved*`;
                            
                            await sock.sendMessage(replyChat, { 
                                image: getBotLogo(), 
                                caption: ownerDetails, 
                                mimetype: 'image/jpeg' 
                            }, { quoted: replyMsg }).catch(async () => {
                                await sock.sendMessage(replyChat, { text: ownerDetails }, { quoted: replyMsg });
                            });
                        }  
                    }
                } catch (error) {  
                    console.error("Alive Listener Error:", error.message);  
                }  
            };  

            const timeout = setTimeout(() => {  
                sock.ev.off('messages.upsert', replyListener);  
                activeAlivePrompts.delete(targetChat);
            }, 60000);

            activeAlivePrompts.set(targetChat, { listener: replyListener, timeout });
            sock.ev.on('messages.upsert', replyListener);

        } catch (err) {
            console.error("Alive Execution Error:", err.message);
            await sock.sendMessage(targetChat, { text: aliveMsg }, { quoted: msg }).catch(() => {});
        }
    }
};

