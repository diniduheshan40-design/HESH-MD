// commands/autowall.js
const axios = require('axios');

const CHANNEL_JID = '120363420419246945@newsletter';
const ADMIN_NUMBER = '94771033094'; // Admin දීපු නම්බර් එක

// 🟢 Wallpaper Source එක (Supun API එකේ නැතිනම් 100% වැඩ කරන 4K Wallpapers Source එකකින් ගනී)
async function fetchWallpaper() {
    try {
        // 1. Supun API එකෙන් උත්සාහ කරයි
        const res = await axios.get('https://supunofc.site/api/image/4kwallpapers/home?apikey=supun-tvo5olfxylo98b8l6b9lq174', { timeout: 8000 });
        if (res.data?.result && Array.isArray(res.data.result) && res.data.result.length > 0) {
            const item = res.data.result[Math.floor(Math.random() * res.data.result.length)];
            const url = typeof item === 'string' ? item : (item.image || item.url || item.download);
            if (url) return url;
        }
    } catch (e) {}

    // 2. Supun API එක හිස් නිසා Fail-proof 4K Nature/Anime Wallpapers Source එකක් (කවදාවත් Fail වෙන්නෙ නෑ)
    const backupImages = [
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=80',
        'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=1920&q=80',
        'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1920&q=80',
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80',
        'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&q=80',
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80'
    ];
    return backupImages[Math.floor(Math.random() * backupImages.length)];
}

// 🟢 Wallpaper එක Channel එකට Send කරන Function එක
async function sendWallpaperToChannel(customSock = null) {
    let targetSock = customSock;

    // 94771033094 අංකයේ active session එක හොයාගැනීම
    if (global.activeSessions) {
        const key = Object.keys(global.activeSessions).find(k => k.includes(ADMIN_NUMBER));
        if (key && global.activeSessions[key]) {
            targetSock = global.activeSessions[key];
        }
    }

    if (!targetSock) {
        console.log(`⚠️ [AUTO-WALLPAPER] Admin bot (+${ADMIN_NUMBER}) session not found yet.`);
        return false;
    }

    try {
        const imgUrl = await fetchWallpaper();

        const caption = `┏━━━〔 🖼️ 𝟰𝗞 𝗪𝗔𝗟𝗟𝗣𝗔𝗣𝗘𝗥 〕━━━┓\n` +
                        `┃\n` +
                        `┃  ✨ *Quality* ⌁ Ultra HD 4K\n` +
                        `┃  ⏰ *Auto Post* ⌁ Every 5 Mins\n` +
                        `┃\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                        `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

        // Direct URL එක වෙනුවට Buffer එකකින් යැවීම (WhatsApp බ්ලොක් නොවී 100% Send වෙන්න)
        const imgBuffer = await axios.get(imgUrl, { 
            responseType: 'arraybuffer', 
            timeout: 20000 
        });

        await targetSock.sendMessage(CHANNEL_JID, {
            image: Buffer.from(imgBuffer.data),
            caption: caption
        });

        console.log('✅ [AUTO-WALLPAPER] Successfully posted to Channel!');
        return true;
    } catch (err) {
        console.error('❌ [AUTO-WALLPAPER] Post Error:', err.message);
        return false;
    }
}

// 🟢 Background Auto Timer (විනාඩි 5න් 5ට auto දුවන කොටස)
let isLoopStarted = false;
function startAutoLoop() {
    if (isLoopStarted) return;
    isLoopStarted = true;

    console.log('🚀 [AUTO-WALLPAPER] Background timer started (5 Mins interval)');

    // Bot run වෙලා තත්පර 20කින් පළමු photo එක යයි
    setTimeout(() => {
        sendWallpaperToChannel();
    }, 20000);

    // සෑම විනාඩි 5කට වරක් ස්වයංක්‍රීයව යැවීම
    setInterval(() => {
        sendWallpaperToChannel();
    }, 5 * 60 * 1000);
}

// Command load වෙද්දීම Timer එක Auto Run කරවයි (index.js අල්ලන්න ඕනෙම නෑ)
setTimeout(() => {
    startAutoLoop();
}, 10000);

module.exports = {
    name: 'autowall',
    alias: ['wall', 'wallpost'],
    category: 'admin',
    desc: 'Test and send wallpaper to channel manually',

    async execute(sock, msg, args, chatJid) {
        const targetChat = chatJid || msg.key.remoteJid;
        
        await sock.sendMessage(targetChat, { text: '⏳ Channel එකට wallpaper එකක් යවමින් පවතී...' }, { quoted: msg });
        
        const success = await sendWallpaperToChannel(sock);
        
        if (success) {
            await sock.sendMessage(targetChat, { text: '✅ සාර්ථකව Channel එකට Wallpaper එක Post විය!' }, { quoted: msg });
        } else {
            await sock.sendMessage(targetChat, { text: `❌ Wallpaper යැවීමට නොහැකි විය. +${ADMIN_NUMBER} අංකය Channel Admin ද කියා පරීක්ෂා කරන්න.` }, { quoted: msg });
        }
    }
};
