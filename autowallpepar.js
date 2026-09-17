// autoWallpaper.js
const axios = require('axios');

// 🔴 Channel JID සහ Admin Bot අංකය
const CHANNEL_JID = '120363420419246945@newsletter';
const ADMIN_BOT_NUMBER = '94771033094'; 
const API_KEY = 'supun-tvo5olfxylo98b8l6b9lq174';

const postedUrls = new Set();
let isTaskRunning = false;

// 🟢 4K Wallpaper API එකෙන් Random පින්තූරයක් ලබා ගැනීම
async function fetchRandomWallpaper() {
    try {
        const randomPage = Math.floor(Math.random() * 8) + 1;
        const apiUrl = `https://supunofc.site/api/image/4kwallpapers/home?page=${randomPage}&apikey=${API_KEY}`;
        
        let res = await axios.get(apiUrl, { timeout: 15000 });
        let list = res.data?.result;

        // Page එකක data නැතිනම් page 1 එකෙන් උත්සාහ කරයි
        if (!list || !Array.isArray(list) || list.length === 0) {
            const fb = await axios.get(`https://supunofc.site/api/image/4kwallpapers/home?apikey=${API_KEY}`, { timeout: 15000 });
            list = fb.data?.result;
        }

        if (!list || !Array.isArray(list) || list.length === 0) return null;

        // කලින් නොයැවූ පින්තූර filter කිරීම
        let available = list.filter(item => {
            const u = typeof item === 'string' ? item : (item.image || item.url || item.download);
            return u && !postedUrls.has(u);
        });

        if (available.length === 0) {
            postedUrls.clear();
            available = list;
        }

        const item = available[Math.floor(Math.random() * available.length)];
        const imgUrl = typeof item === 'string' ? item : (item.image || item.url || item.download || item.link);
        const title = (typeof item === 'object' && item.title) ? item.title : 'Ultra HD 4K Wallpaper';

        if (!imgUrl) return null;
        postedUrls.add(imgUrl);

        return { imgUrl, title };
    } catch (e) {
        console.error('❌ [WALLPAPER-API-ERROR]:', e.message);
        return null;
    }
}

// 🟢 Admin Bot මඟින් පමණක් Channel එකට Post කිරීම
async function postWallpaperFromAdmin() {
    // 94771033094 Session එක online ද බැලීම
    let adminSock = global.activeSessions ? global.activeSessions[ADMIN_BOT_NUMBER] : null;

    // අංකයේ formats (උදා: 94771033094:1 වැනි) සොයා බැලීම
    if (!adminSock && global.activeSessions) {
        const matchingKey = Object.keys(global.activeSessions).find(k => k.includes(ADMIN_BOT_NUMBER));
        if (matchingKey) adminSock = global.activeSessions[matchingKey];
    }

    if (!adminSock || !adminSock.sendMessage) {
        console.log(`⚠️ [AUTO-WALLPAPER] Admin bot (+${ADMIN_BOT_NUMBER}) is not connected yet. Retrying next cycle...`);
        return;
    }

    const wpData = await fetchRandomWallpaper();
    if (!wpData) {
        console.log('⚠️ [AUTO-WALLPAPER] Could not fetch a valid wallpaper.');
        return;
    }

    const { imgUrl, title } = wpData;

    const caption = `┏━━━〔 🖼️ 𝟰𝗞 𝗪𝗔𝗟𝗟𝗣𝗔𝗣𝗘𝗥 〕━━━┓\n` +
                    `┃\n` +
                    `┃  📌 *Title* ⌁ ${title}\n` +
                    `┃  ✨ *Quality* ⌁ Ultra HD 4K\n` +
                    `┃  ⏰ *Auto Post* ⌁ Every 5 Mins\n` +
                    `┃\n` +
                    `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                    `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

    try {
        // Image එක Buffer එකක් ලෙස download කර යැවීම (Error නොවී යැවීම සඳහා)
        const imgBuffer = await axios.get(imgUrl, { 
            responseType: 'arraybuffer', 
            timeout: 25000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        await adminSock.sendMessage(CHANNEL_JID, {
            image: Buffer.from(imgBuffer.data),
            caption: caption
        });

        console.log(`✅ [AUTO-WALLPAPER] Posted to Channel via Admin Bot +${ADMIN_BOT_NUMBER} | Title: ${title}`);
    } catch (err) {
        console.error(`❌ [AUTO-WALLPAPER] Failed to send image:`, err.message);
    }
}

function startAutoWallpaper() {
    if (isTaskRunning) return;
    isTaskRunning = true;

    console.log(`🚀 [AUTO-WALLPAPER] Service configured for Admin Bot: +${ADMIN_BOT_NUMBER}`);

    // Session connect වීමට තත්පර 10ක් රැඳී පළමු wallpaper එක යැවීම
    setTimeout(() => {
        postWallpaperFromAdmin();
    }, 10000);

    // සෑම විනාඩි 5කට වරක් ක්‍රියාත්මක වීම
    setInterval(() => {
        postWallpaperFromAdmin();
    }, 5 * 60 * 1000);
}

module.exports = { startAutoWallpaper };
