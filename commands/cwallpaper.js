// commands/setchannel.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

const CONFIG_PATH = path.join(__dirname, '../temp/channel_config.json');
const API_KEY = 'supun-tvo5olfxylo98b8l6b9lq174';

const BACKUP_WALLPAPERS = [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=80',
    'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=1920&q=80',
    'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1920&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80'
];

let autoInterval = null;

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        }
    } catch (e) {}
    return { targetChannel: null };
}

function saveConfig(data) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
    } catch (e) {}
}

async function fetchWallpaperUrl() {
    try {
        const randomPage = Math.floor(Math.random() * 8) + 1;
        const res = await axios.get(`https://supunofc.site/api/image/4kwallpapers/home?page=${randomPage}&apikey=${API_KEY}`, { timeout: 10000 });
        if (res.data?.result && Array.isArray(res.data.result) && res.data.result.length > 0) {
            const item = res.data.result[Math.floor(Math.random() * res.data.result.length)];
            const url = typeof item === 'string' ? item : (item.image || item.url || item.download);
            if (url) return url;
        }
    } catch (e) {}
    return BACKUP_WALLPAPERS[Math.floor(Math.random() * BACKUP_WALLPAPERS.length)];
}

// 🟢 WhatsApp Newsletter Protocol එක හරහා Post කරන නියම Function එක
async function sendToNewsletter(sock, channelJid) {
    try {
        const imgUrl = await fetchWallpaperUrl();
        const caption = `┏━━━〔 🖼️ 𝟰𝗞 𝗪𝗔𝗟𝗟𝗣𝗔𝗣𝗘𝗥 〕━━━┓\n` +
                        `┃\n` +
                        `┃  ✨ *Quality* ⌁ Ultra HD 4K\n` +
                        `┃  ⏰ *Auto Post* ⌁ Every 5 Mins\n` +
                        `┃\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                        `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

        // 1. Image එක Buffer එකක් ලෙස ගැනීම
        const response = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 20000 });
        const imgBuffer = Buffer.from(response.data);

        // 2. Newsletter Media Node එක සෑදීම
        const mediaContent = await generateWAMessageContent({
            image: imgBuffer,
            caption: caption
        }, { upload: sock.waUploadToServer });

        const newsletterMsg = generateWAMessageFromContent(channelJid, {
            imageMessage: mediaContent.imageMessage
        }, {});

        // 3. RelayMessage හරහා Newsletter එකට යැවීම
        await sock.relayMessage(channelJid, newsletterMsg.message, {
            messageId: newsletterMsg.key.id
        });

        console.log(`✅ [NEWSLETTER] Posted image successfully to: ${channelJid}`);
        return { success: true };
    } catch (err) {
        console.error(`❌ [NEWSLETTER-ERROR]:`, err);
        return { success: false, error: err.message };
    }
}

function startAutoPosting(sock) {
    if (autoInterval) clearInterval(autoInterval);

    const config = loadConfig();
    if (!config.targetChannel) return;

    // විනාඩි 5න් 5ට
    autoInterval = setInterval(async () => {
        const currentCfg = loadConfig();
        if (currentCfg.targetChannel) {
            await sendToNewsletter(sock, currentCfg.targetChannel);
        }
    }, 5 * 60 * 1000);
}

module.exports = {
    name: 'setchannel',
    alias: ['autowp', 'wallchannel'],
    category: 'admin',
    desc: 'Set channel JID for auto wallpaper posting',

    async execute(sock, msg, args, chatJid) {
        const targetChat = chatJid || msg.key.remoteJid;
        const input = args[0] ? args[0].trim() : '';

        // Stop කිරීම
        if (input.toLowerCase() === 'stop' || input.toLowerCase() === 'off') {
            if (autoInterval) {
                clearInterval(autoInterval);
                autoInterval = null;
            }
            saveConfig({ targetChannel: null });
            return await sock.sendMessage(targetChat, { 
                text: '🛑 *Auto Wallpaper Posting නවත්වන ලදී!*' 
            }, { quoted: msg });
        }

        // Validation
        if (!input || !input.includes('@newsletter')) {
            const config = loadConfig();
            return await sock.sendMessage(targetChat, {
                text: `⚠️ *කරුණාකර Channel JID එක ලබා දෙන්න!*\n\n` +
                      `📌 *උදාහරණ:*\n• .setchannel 120363420419246945@newsletter\n` +
                      `• .setchannel stop\n\n` +
                      `⚙️ *දැනට ඇති Channel:* ${config.targetChannel || 'නැත'}`
            }, { quoted: msg });
        }

        // Channel එකට Test Post එකක් යවලා බැලීම
        await sock.sendMessage(targetChat, { 
            text: `⏳ *Channel එකට සම්බන්ධ වෙමින් පවතී...*\nපළමු පින්තූරය යවමින් පරීක්ෂා කෙරේ.` 
        }, { quoted: msg });

        const testResult = await sendToNewsletter(sock, input);

        if (testResult.success) {
            saveConfig({ targetChannel: input });
            startAutoPosting(sock);

            await sock.sendMessage(targetChat, {
                text: `✅ *සාර්ථකයි! පළමු පින්තූරය Channel එකට Post විය.*\n\n📢 *Channel:* ${input}\n⏱️ *කාලය:* සෑම විනාඩි 5කට වරක් ස්වයංක්‍රීයව පින්තූර වැටෙනු ඇත.`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(targetChat, {
                text: `❌ *Channel එකට Post කිරීමට නොහැකි විය!*\n\n*හේතුව:* ${testResult.error}\n\n⚠️ *විසඳුම:* මෙම බොට් අංකය අදාළ Channel එකේ Admin කෙනෙක් බවට පත් කර ඇත්දැයි නැවත තහවුරු කරගන්න!`
            }, { quoted: msg });
        }
    }
};

