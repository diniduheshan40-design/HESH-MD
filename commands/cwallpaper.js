// commands/setchannel.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

const CONFIG_PATH = path.join(process.cwd(), 'temp', 'channel_config.json');

// 🟢 4K Wallpapers Fail-Proof Collection
const WALLPAPER_COLLECTION = [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=80',
    'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=1920&q=80',
    'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1920&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80'
];

// Memory Leak හෝ Timer Loss වීම වැළැක්වීමට Global Timer එකක්
global.channelWallpaperInterval = global.channelWallpaperInterval || null;

function getConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
    } catch (e) {}
    return { channelJid: null };
}

function saveConfig(data) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
    } catch (e) {}
}

async function getWallpaperBuffer() {
    let imgUrl = null;
    try {
        const res = await axios.get('https://supunofc.site/api/image/4kwallpapers/home?apikey=supun-tvo5olfxylo98b8l6b9lq174', { timeout: 8000 });
        if (res.data?.result && Array.isArray(res.data.result) && res.data.result.length > 0) {
            const item = res.data.result[Math.floor(Math.random() * res.data.result.length)];
            imgUrl = typeof item === 'string' ? item : (item.image || item.url || item.download);
        }
    } catch (e) {}

    if (!imgUrl) {
        imgUrl = WALLPAPER_COLLECTION[Math.floor(Math.random() * WALLPAPER_COLLECTION.length)];
    }

    const response = await axios.get(imgUrl, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    return Buffer.from(response.data);
}

// 🟢 Channel එකට RelayMessage මඟින් Post කිරීම
async function postWallpaper(sock, channelJid) {
    try {
        const buffer = await getWallpaperBuffer();
        const caption = `┏━━━〔 🖼️ 𝟰𝗞 𝗪𝗔𝗟𝗟𝗣𝗔𝗣𝗘𝗥 〕━━━┓\n` +
                        `┃\n` +
                        `┃  ✨ *Quality* ⌁ Ultra HD 4K\n` +
                        `┃  ⏰ *Auto Post* ⌁ Every 5 Mins\n` +
                        `┃\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                        `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

        const media = await generateWAMessageContent({
            image: buffer,
            caption: caption
        }, { upload: sock.waUploadToServer });

        const fullMsg = generateWAMessageFromContent(channelJid, {
            imageMessage: media.imageMessage
        }, {});

        await sock.relayMessage(channelJid, fullMsg.message, {
            messageId: fullMsg.key.id
        });

        console.log(`✅ [AUTO-WALLPAPER] Successfully posted to ${channelJid} at ${new Date().toLocaleTimeString()}`);
        return true;
    } catch (err) {
        console.error('❌ [AUTO-WALLPAPER-POST-ERROR]:', err.message);
        return false;
    }
}

// 🟢 විනාඩි 5න් 5ට දුවන ස්ථිර Background Loop එක
function startGlobalLoop(sock, channelJid) {
    if (global.channelWallpaperInterval) {
        clearInterval(global.channelWallpaperInterval);
        global.channelWallpaperInterval = null;
    }

    console.log(`🚀 [AUTO-WALLPAPER] Background scheduler active for: ${channelJid}`);

    // විනාඩි 5කට වරක් (5 * 60 * 1000)
    global.channelWallpaperInterval = setInterval(async () => {
        const cfg = getConfig();
        const target = cfg.channelJid || channelJid;
        if (!target) return;

        // Active Session එක නිවැරදිව ලබා ගැනීම
        let activeSock = sock;
        if (global.activeSessions) {
            const keys = Object.keys(global.activeSessions);
            if (keys.length > 0) activeSock = global.activeSessions[keys[0]];
        }

        if (activeSock && activeSock.relayMessage) {
            await postWallpaper(activeSock, target);
        }
    }, 5 * 60 * 1000);
}

module.exports = {
    name: 'setchannel',
    alias: ['autowallpaper', 'wallpost'],
    category: 'admin',
    desc: 'Set channel JID or link for auto wallpaper posting',

    async execute(sock, msg, args, chatJid) {
        const targetChat = chatJid || msg.key.remoteJid;
        const input = args[0] ? args[0].trim() : '';

        // Stop කිරීම
        if (input.toLowerCase() === 'stop' || input.toLowerCase() === 'off') {
            if (global.channelWallpaperInterval) {
                clearInterval(global.channelWallpaperInterval);
                global.channelWallpaperInterval = null;
            }
            saveConfig({ channelJid: null });
            return await sock.sendMessage(targetChat, { text: '🛑 *Auto Wallpaper Posting සේවාව නවත්වන ලදී.*' }, { quoted: msg });
        }

        let resolvedJid = null;

        // Channel Link හෝ JID හඳුනා ගැනීම
        if (input.includes('whatsapp.com/channel/')) {
            try {
                const inviteCode = input.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0].trim();
                if (typeof sock.newsletterMetadata === 'function') {
                    const meta = await sock.newsletterMetadata('invite', inviteCode);
                    if (meta?.id) resolvedJid = meta.id;
                }
            } catch (e) {}
        } else if (input.includes('@newsletter')) {
            resolvedJid = input;
        }

        if (!resolvedJid) {
            const cfg = getConfig();
            return await sock.sendMessage(targetChat, {
                text: `⚠️ *කරුණාකර වලංගු Channel Link එකක් හෝ JID එකක් ලබා දෙන්න!*\n\n` +
                      `📌 *උදාහරණ:*\n• .setchannel 120363420419246945@newsletter\n` +
                      `• .setchannel stop\n\n` +
                      `⚙️ *වත්මන් Channel:* ${cfg.channelJid || 'සකසා නැත'}`
            }, { quoted: msg });
        }

        await sock.sendMessage(targetChat, { text: `⏳ *පළමු Wallpaper එක Channel එකට යවමින් සේවාව සක්‍රිය කෙරේ...*` }, { quoted: msg });

        // පළමු පින්තූරය යැවීම
        const success = await postWallpaper(sock, resolvedJid);

        if (success) {
            saveConfig({ channelJid: resolvedJid });
            startGlobalLoop(sock, resolvedJid);

            await sock.sendMessage(targetChat, {
                text: `✅ *Auto Wallpaper Posting සාර්ථකව සක්‍රිය විය!*\n\n` +
                      `📢 *Channel JID:* ${resolvedJid}\n` +
                      `⏱️ *කාල පරතරය:* සෑම විනාඩි 5කට වරක්\n\n` +
                      `> ⚡ පළමු Wallpaper එක Channel එකට Post විය. මෙතැන් සිට ස්වයංක්‍රීයව පින්තූර වැටෙනු ඇත.`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(targetChat, {
                text: `❌ *පින්තූරය යැවීමට නොහැකි විය. Bot අංකයට Channel Admin බලතල ලබා දී ඇත්දැයි බලන්න.*`
            }, { quoted: msg });
        }
    }
};

