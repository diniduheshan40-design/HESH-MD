// commands/wallpost.js
const axios = require('axios');

const CHANNEL_JID = '120363420419246945@newsletter';
const ADMIN_NUM = '94771033094';

// 4K Wallpaper එකක් ගන්න API එක
async function getWallpaper() {
    try {
        // 1. Supun API එක
        const res = await axios.get(`https://supunofc.site/api/image/4kwallpapers/home?apikey=supun-tvo5olfxylo98b8l6b9lq174`, { timeout: 10000 });
        if (res.data?.result && res.data.result.length > 0) {
            const item = res.data.result[Math.floor(Math.random() * res.data.result.length)];
            const url = typeof item === 'string' ? item : (item.image || item.url || item.download);
            if (url) return url;
        }
    } catch (e) {}

    // 2. Supun API එකෙන් data නැතිනම් (Backup 4K Source)
    return `https://picsum.photos/1920/1080?random=${Date.now()}`;
}

async function postWallpaper(sock) {
    try {
        // 94771033094 bot session එක සොයා ගැනීම
        let targetSock = sock;
        if (global.activeSessions) {
            const key = Object.keys(global.activeSessions).find(k => k.includes(ADMIN_NUM));
            if (key && global.activeSessions[key]) targetSock = global.activeSessions[key];
        }

        if (!targetSock) return;

        const imgUrl = await getWallpaper();
        const caption = `┏━━━〔 🖼️ 𝟰𝗞 𝗪𝗔𝗟𝗟𝗣𝗔𝗣𝗘𝗥 〕━━━┓\n` +
                        `┃\n` +
                        `┃  ✨ *Quality* ⌁ Ultra HD 4K\n` +
                        `┃  ⏰ *Auto Post* ⌁ Every 5 Mins\n` +
                        `┃\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                        `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

        const imgBuffer = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 20000 });

        await targetSock.sendMessage(CHANNEL_JID, {
            image: Buffer.from(imgBuffer.data),
            caption: caption
        });

        console.log('✅ [AUTO-WALLPAPER] Posted to channel successfully!');
    } catch (err) {
        console.log('⚠️ [AUTO-WALLPAPER] Error:', err.message);
    }
}

// Background Timer එක (Commands load වෙද්දිම auto start වෙනවා, index.js අල්ලන්න ඕනෙ නෑ)
let timerStarted = false;
function initAutoLoop(sock) {
    if (timerStarted) return;
    timerStarted = true;
    
    setTimeout(() => {
        postWallpaper(sock);
        setInterval(() => postWallpaper(sock), 5 * 60 * 1000);
    }, 15000);
}

module.exports = {
    name: 'wallpost',
    alias: ['sendwall'],
    category: 'admin',
    desc: 'Manually send 4k wallpaper to channel',

    async execute(sock, msg, args, chatJid) {
        // Bot run වෙද්දි Auto Loop එක auto trigger කරගන්නවා
        initAutoLoop(sock);

        await postWallpaper(sock);
        await sock.sendMessage(chatJid || msg.key.remoteJid, { text: '✅ Wallpaper sent to channel!' }, { quoted: msg });
    }
};

// Command load වෙන වෙලාවෙම loop එක background එකෙන් දුවන්න
setTimeout(() => {
    initAutoLoop(null);
}, 10000);

