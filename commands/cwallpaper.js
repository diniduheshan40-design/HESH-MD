// commands/setchannel.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../temp/channel_config.json');
const API_KEY = 'supun-tvo5olfxylo98b8l6b9lq174';

// Backup 4K Wallpaper Sources (API එක හිස් උනොත් Fail නොවී යැවීම සඳහා)
const BACKUP_WALLPAPERS = [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=80',
    'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=1920&q=80',
    'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1920&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80'
];

let autoInterval = null;

// Channel Config එක Load කිරීම
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        }
    } catch (e) {}
    return { targetChannel: null };
}

// Channel Config එක Save කිරීම
function saveConfig(data) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Config Save Error:', e.message);
    }
}

// Wallpaper API එකෙන් URL එකක් ගැනීම
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

    // Supun API එකේ data නැතිනම් Backup Array එකෙන් එකක් තෝරා ගැනීම
    return BACKUP_WALLPAPERS[Math.floor(Math.random() * BACKUP_WALLPAPERS.length)];
}

// Wallpaper එක Channel එකට Post කිරීම
async function postToChannel(sock) {
    const config = loadConfig();
    if (!config.targetChannel) return;

    try {
        const imgUrl = await fetchWallpaperUrl();
        const caption = `┏━━━〔 🖼️ 𝟰𝗞 𝗪𝗔𝗟𝗟𝗣𝗔𝗣𝗘𝗥 〕━━━┓\n` +
                        `┃\n` +
                        `┃  ✨ *Quality* ⌁ Ultra HD 4K\n` +
                        `┃  ⏰ *Auto Post* ⌁ Every 5 Mins\n` +
                        `┃\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                        `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

        // Direct Buffer එකක් ලෙස download කර යැවීම (Block නොවී සාර්ථකව Send වීමට)
        const response = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 20000 });

        await sock.sendMessage(config.targetChannel, {
            image: Buffer.from(response.data),
            caption: caption
        });

        console.log(`✅ [AUTO-WALLPAPER] Successfully posted to ${config.targetChannel}`);
    } catch (err) {
        console.error('❌ [AUTO-WALLPAPER] Post Error:', err.message);
    }
}

// Auto Task එක පටන් ගැනීම
function startAutoPosting(sock) {
    if (autoInterval) clearInterval(autoInterval);

    // පටන් ගත් සැනින් පළමු පින්තූරය යැවීම
    postToChannel(sock);

    // සෑම විනාඩි 5කට වරක් (5 * 60 * 1000)
    autoInterval = setInterval(() => {
        postToChannel(sock);
    }, 5 * 60 * 1000);
}

module.exports = {
    name: 'setchannel',
    alias: ['autowp', 'wallchannel'],
    category: 'admin',
    desc: 'Set channel JID for auto wallpaper posting every 5 minutes',

    async execute(sock, msg, args, chatJid) {
        const targetChat = chatJid || msg.key.remoteJid;
        const input = args[0] ? args[0].trim() : '';

        // 1. Auto Post නැවැත්වීමට
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

        // 2. Channel JID එක Validation කිරීම
        if (!input || !input.includes('@newsletter')) {
            const config = loadConfig();
            return await sock.sendMessage(targetChat, {
                text: `⚠️ *කරුණාකර නිවැරදි Channel JID එකක් ඇතුළත් කරන්න!*\n\n` +
                      `📌 *භාවිතය:*\n` +
                      `• .setchannel 120363420419246945@newsletter\n` +
                      `• .setchannel stop _(Auto post නැවැත්වීමට)_\n\n` +
                      `⚙️ *දැනට Set කර ඇති Channel:* ${config.targetChannel || 'නැත'}`
            }, { quoted: msg });
        }

        // 3. JID එක Save කර Task එක ආරම්භ කිරීම
        saveConfig({ targetChannel: input });

        await sock.sendMessage(targetChat, {
            text: `✅ *Auto Wallpaper Channel සාර්ථකව සකසන ලදී!*\n\n` +
                  `📢 *Channel JID:* ${input}\n` +
                  `⏱️ *කාල පරතරය:* සෑම විනාඩි 5කට වරක්\n\n` +
                  `> ⚡ පළමු Wallpaper එක දැන් Channel එකට යවනු ලැබේ...`
        }, { quoted: msg });

        // Auto posting ආරම්භ කිරීම
        startAutoPosting(sock);
    }
};

