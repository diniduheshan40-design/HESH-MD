// commands/alive.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const LOCAL_LOGO = path.join(process.cwd(), 'logo.jpg');
const FALLBACK_LOGO_URL = 'https://files.catbox.moe/gs150o.jpg';

function getEmojiTime(jid) {
    let tz = 'Asia/Colombo'; 
    try {
        if (jid && jid.includes('@s.whatsapp.net')) {
            const num = jid.split('@')[0].split(':')[0]; 
            if (num.startsWith('91')) tz = 'Asia/Kolkata'; 
            else if (num.startsWith('92')) tz = 'Asia/Karachi'; 
            else if (num.startsWith('971')) tz = 'Asia/Dubai'; 
            else if (num.startsWith('966')) tz = 'Asia/Riyadh'; 
            else if (num.startsWith('974')) tz = 'Asia/Qatar'; 
            else if (num.startsWith('60')) tz = 'Asia/Kuala_Lumpur'; 
            else if (num.startsWith('65')) tz = 'Asia/Singapore'; 
            else if (num.startsWith('44')) tz = 'Europe/London'; 
            else if (num.startsWith('1') && num.length <= 12) tz = 'America/New_York'; 
            else if (num.startsWith('61')) tz = 'Australia/Sydney'; 
            else if (num.startsWith('880')) tz = 'Asia/Dhaka'; 
            else if (num.startsWith('39') || num.startsWith('49') || num.startsWith('33')) tz = 'Europe/Berlin'; 
        }

        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true
        });

        const parts = formatter.formatToParts(new Date());
        let hours = parts.find(p => p.type === 'hour')?.value || '00';
        let minutes = parts.find(p => p.type === 'minute')?.value || '00';
        let ampm = parts.find(p => p.type === 'dayPeriod')?.value.toUpperCase() || 'AM';

        const numberMap = { '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣', '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣' };
        
        let emojiHours = hours.split('').map(d => numberMap[d] || d).join('');
        let emojiMinutes = minutes.split('').map(d => numberMap[d] || d).join('');
        let emojiAmPm = ampm === 'PM' ? '🇵‌🇲‌' : '🇦‌🇲‌';
        
        return `${emojiHours} : ${emojiMinutes} ${emojiAmPm}`;
    } catch (e) {
        return "12:00 🇵‌🇲‌";
    }
}

function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

const triggerCommand = async (cmdName, fakeUserText, sock, replyMsg) => {
    try {
        const cmdPath = path.join(__dirname, `${cmdName}.js`);
        if (fs.existsSync(cmdPath)) {
            const cmdModule = require(cmdPath);
            const remoteJid = replyMsg.key.remoteJid;
            const args = fakeUserText.trim().split(/\s+/).slice(1);

            if (typeof cmdModule.execute === 'function') {
                await cmdModule.execute(sock, replyMsg, args, remoteJid);
            } else if (typeof cmdModule.run === 'function') {
                await cmdModule.run({ sock, msg: replyMsg, args, from: remoteJid });
            } else if (typeof cmdModule === 'function') {
                await cmdModule({ sock, msg: replyMsg, args, from: remoteJid });
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

        sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

        let pushName = msg.pushName || "User";  
        let firstName = pushName.split(/[\s_+-]+/)[0] || "User"; 
        if (firstName.length > 15) firstName = firstName.substring(0, 15);  

        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const currentPrefix = (rawText && /^[.#/!]/.test(rawText.charAt(0))) ? rawText.charAt(0) : '.';

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
            let imagePayload = { url: FALLBACK_LOGO_URL };
            if (fs.existsSync(LOCAL_LOGO)) {
                imagePayload = fs.readFileSync(LOCAL_LOGO);
            }

            const sentMsg = await sock.sendMessage(targetChat, {
                image: imagePayload,
                caption: aliveMsg
            }, { quoted: msg }).catch(async () => {
                return await sock.sendMessage(targetChat, { text: aliveMsg }, { quoted: msg });
            });

            const stanzaId = sentMsg?.key?.id;
            let cleanupTimer;

            const replyListener = async (m) => {  
                try {  
                    const replyMsg = m.messages?.[0];  
                    if (!replyMsg || !replyMsg.message) return; 

                    let msgContent = replyMsg.message;
                    if (msgContent.ephemeralMessage) msgContent = msgContent.ephemeralMessage.message;
                    if (msgContent.viewOnceMessage) msgContent = msgContent.viewOnceMessage.message;

                    const msgContext = msgContent?.extendedTextMessage?.contextInfo ||
                                       msgContent?.imageMessage?.contextInfo ||
                                       msgContent?.videoMessage?.contextInfo;

                    if (stanzaId && msgContext?.stanzaId !== stanzaId) return;  

                    let replyText = msgContent.conversation || 
                                    msgContent.extendedTextMessage?.text || 
                                    msgContent.imageMessage?.caption || 
                                    msgContent.videoMessage?.caption || "";

                    replyText = replyText.trim().replace(/[\[\]]/g, ''); // User '1' හෝ '[1]' දැම්මත් handle කරයි 
                    const replyChat = replyMsg.key.remoteJid;

                    if (["1", "2", "3"].includes(replyText)) {
                        sock.ev.off('messages.upsert', replyListener);
                        if (cleanupTimer) clearTimeout(cleanupTimer);

                        if (replyText === "1") {  
                            await sock.sendMessage(replyChat, { react: { text: '📜', key: replyMsg.key } }).catch(() => {});  
                            await triggerCommand('menu', `${currentPrefix}menu`, sock, replyMsg);

                        } else if (replyText === "2") {  
                            await sock.sendMessage(replyChat, { react: { text: '⚡', key: replyMsg.key } }).catch(() => {});
                            await triggerCommand('ping', `${currentPrefix}ping`, sock, replyMsg);

                        } else if (replyText === "3") {  
                            await sock.sendMessage(replyChat, { react: { text: '👑', key: replyMsg.key } }).catch(() => {});
                            const ownerDetails = `*👑 HESHAN-MD OWNER INFO*\n\n` +
                                                 `*• Name:* Dinidu Heshan\n` +
                                                 `*• Status:* Active\n` +
                                                 `*• Contact:* wa.me/94719845166\n\n` +
                                                 `> 🔐 *heshan ofc • all rights reserved*`;
                            
                            await sock.sendMessage(replyChat, { text: ownerDetails }, { quoted: replyMsg });
                        }  
                    }
                } catch (error) {  
                    console.error("Alive Listener Error:", error.message);  
                }  
            };  

            sock.ev.on('messages.upsert', replyListener);  

            cleanupTimer = setTimeout(() => {  
                sock.ev.off('messages.upsert', replyListener);  
            }, 60000);  

        } catch (err) {
            console.error("Alive Execution Error:", err.message);
            await sock.sendMessage(targetChat, { text: aliveMsg }, { quoted: msg }).catch(() => {});
        }
    }
};

