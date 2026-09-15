// commands/alive.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const fetch = require('node-fetch');

// Channel Forward Context
const CACHED_CHANNEL_JID = "120363413193872888@newsletter";
const LOGO_URL = "https://files.catbox.moe/a58add.jpeg";

function getEmojiTime(jid) {
    let tz = 'Asia/Colombo'; 
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
}

function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

// Sub-commands trigger helper
const triggerCommand = async (cmdName, fakeUserText, sock, replyMsg, safeReply) => {
    try {
        const cmdPath = path.join(__dirname, `${cmdName}.js`);
        if (fs.existsSync(cmdPath)) {
            delete require.cache[require.resolve(cmdPath)];
            const cmdModule = require(cmdPath);
            const remoteJid = replyMsg.key.remoteJid;
            const args = fakeUserText.trim().split(/\s+/).slice(1);

            if (typeof cmdModule.execute === 'function') {
                await cmdModule.execute(sock, replyMsg, args, remoteJid, safeReply);
            } else if (typeof cmdModule.run === 'function') {
                await cmdModule.run({ sock, msg: replyMsg, args, from: remoteJid });
            } else if (typeof cmdModule === 'function') {
                await cmdModule({ sock, msg: replyMsg, args, from: remoteJid });
            }
        }
    } catch (e) {
        console.error(`❌ Error triggering ${cmdName}:`, e);
    }
};

module.exports = {
    name: 'alive',
    category: 'general',
    desc: 'Check bot operational status and quick menu',

    async execute(sock, msg, args, chatJid, safeReply) {
        const targetChat = chatJid || msg.key.remoteJid;
        const senderJid = msg.key.participant || targetChat;
        
        let pushName = msg.pushName || "User";  
        let firstName = pushName.split(/[\s_+-]+/)[0] || "User"; 
        if (firstName.length > 15) firstName = firstName.substring(0, 15);  

        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const currentPrefix = (rawText && /^[.#/!]/.test(rawText.charAt(0))) ? rawText.charAt(0) : '.';

        // 1. Reaction එක ලබා දීම
        sock.sendMessage(targetChat, { react: { text: '⚡', key: msg.key } }).catch(() => {});

        // 2. විස්තර සකස් කිරීම
        const uptime = formatUptime(process.uptime());
        const emojiTime = getEmojiTime(senderJid);

        const aliveMsg = `*𝐖ᴇʟᴄᴏᴍᴇ 𝐓ᴏ 𝐇𝐄𝐒𝐇𝐀𝐍-𝐌𝐃* ༻
✧ 𝗛𝗲𝗹𝗹𝗼 👋 ${firstName} ✧𓆩⚔𓆪
╔═══❈═══════៚
║ ☬ 𝙊𝙒𝙉𝙀𝙍 ⌁ *Dinidu Heshan*
║ ☬ 𝘽𝙊𝙏   ⌁ *ʜᴇsʜᴀɴ-ᴍᴅ*
║ ☬ 𝙐𝙋𝙏𝙄𝙈𝙀⌁ *${uptime}*
║ ☬ 𝙎𝙏𝘼𝙏𝙐𝙎 ⌁ *Online 🟢*
╚═══❈══════࿐
❰彡 ⚡ 𝙄'𝙈 𝘼𝙇𝙄𝙑𝙀 𝙉𝙊𝙒 彡❱
 ⏰ *𝖳𝖨𝖬𝖤 - ${emojiTime}*

*╔═「 𝙍𝙚𝙥𝙡𝙮 𝙉𝙪𝙢𝙗𝙚𝙧 ⌁彡* 
*║* ➊ 𝙈𝘼𝙄𝙉 𝙈𝙀𝙉𝙐
*║* ➋ 𝙋𝙄𝙉𝙂 𝙎𝙋𝙀𝙀𝘿
*║* ➌ 𝙊𝙒𝙉𝙀𝙍 𝙄𝙉𝙁𝙊
*╚════════════៚*
> 🔐 *heshan ofc • all rights reserved*`;

        const channelContext = {
            forwardingScore: 1, 
            isForwarded: true,
            forwardedNewsletterMessageInfo: { 
                newsletterJid: CACHED_CHANNEL_JID, 
                newsletterName: "HESHAN MD SYSTEM 👾", 
                serverMessageId: 100 
            }
        };

        try {
            // 3. Image එක Buffer එකක් ලෙස download කර යැවීම (Download error වුවහොත් Direct URL එකෙන් යවයි)
            let imagePayload = { url: LOGO_URL };
            try {
                const imgRes = await fetch(LOGO_URL);
                if (imgRes.ok) {
                    const imgBuffer = await imgRes.buffer();
                    imagePayload = imgBuffer;
                }
            } catch (e) {}

            const sentMsg = await sock.sendMessage(targetChat, {
                image: imagePayload,
                caption: aliveMsg,
                contextInfo: channelContext
            }, { quoted: msg });

            const stanzaId = sentMsg.key.id;
            const usedOptions = new Set();

            // 4. Interactive Reply Listener (1, 2, 3 සඳහා)
            const replyListener = async (m) => {  
                try {  
                    const replyMsg = m.messages[0];  
                    if (!replyMsg.message) return; 

                    let msgContent = replyMsg.message;
                    if (msgContent.ephemeralMessage) msgContent = msgContent.ephemeralMessage.message;
                    if (msgContent.viewOnceMessage) msgContent = msgContent.viewOnceMessage.message;

                    const msgContext = msgContent?.extendedTextMessage?.contextInfo ||
                                       msgContent?.imageMessage?.contextInfo ||
                                       msgContent?.videoMessage?.contextInfo;

                    if (msgContext?.stanzaId !== stanzaId) return;  

                    let replyText = msgContent.conversation || 
                                    msgContent.extendedTextMessage?.text || 
                                    msgContent.imageMessage?.caption || 
                                    msgContent.videoMessage?.caption || "";

                    replyText = replyText.trim();  
                    const replyChat = replyMsg.key.remoteJid;

                    if (["1", "2", "3"].includes(replyText)) {
                        if (usedOptions.has(replyText)) return; 
                        usedOptions.add(replyText);

                        if (replyText === "1") {  
                            await sock.sendMessage(replyChat, { react: { text: '📜', key: replyMsg.key } }).catch(() => {});  
                            await triggerCommand('menu', `${currentPrefix}menu`, sock, replyMsg, safeReply);

                        } else if (replyText === "2") {  
                            await sock.sendMessage(replyChat, { react: { text: '⚡', key: replyMsg.key } }).catch(() => {});
                            await triggerCommand('ping', `${currentPrefix}ping`, sock, replyMsg, safeReply);

                        } else if (replyText === "3") {  
                            await sock.sendMessage(replyChat, { react: { text: '👑', key: replyMsg.key } }).catch(() => {});
                            const ownerDetails = `*👑 HESHAN-MD OWNER INFO*\n\n` +
                                                 `*• Name:* Dinidu Heshan\n` +
                                                 `*• Status:* Active\n` +
                                                 `*• Contact:* wa.me/94770000000\n\n` +
                                                 `> 🔐 *heshan ofc • all rights reserved*`;
                            
                            await sock.sendMessage(replyChat, { 
                                text: ownerDetails, 
                                contextInfo: channelContext 
                            }, { quoted: replyMsg });
                        }  
                    }
                } catch (error) {  
                    console.error("Alive Listener Error:", error);  
                }  
            };  

            sock.ev.on('messages.upsert', replyListener);  

            // තත්පර 60 කට පසු listener එක ඉවත් කිරීම
            setTimeout(() => {  
                sock.ev.off('messages.upsert', replyListener);  
            }, 60000);  

        } catch (err) {
            console.error("Alive Error:", err);
            if (safeReply) {
                await safeReply(targetChat, '❌ Alive command error.');
            }
        }
    }
};

