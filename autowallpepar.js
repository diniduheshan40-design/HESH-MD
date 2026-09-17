// autoWallpaper.js
const axios = require('axios');

const CHANNEL_JID = '120363420419246945@newsletter';
const API_KEY = 'supun-tvo5olfxylo98b8l6b9lq174';

const postedUrls = new Set();

function startAutoWallpaper(sock) {
    console.log('🚀 [AUTO-WALLPAPER] Service Started for Channel: 120363420419246945@newsletter');

    const sendRandomWallpaper = async () => {
        try {
            const randomPage = Math.floor(Math.random() * 10) + 1;
            const apiUrl = `https://supunofc.site/api/image/4kwallpapers/home?page=${randomPage}&apikey=${API_KEY}`;

            const response = await axios.get(apiUrl, { timeout: 20000 });
            const data = response.data;

            if (!data || !data.success || !Array.isArray(data.result) || data.result.length === 0) {
                const fallbackRes = await axios.get(`https://supunofc.site/api/image/4kwallpapers/home?apikey=${API_KEY}`, { timeout: 20000 });
                if (!fallbackRes.data?.result?.length) return;
                data.result = fallbackRes.data.result;
            }

            let availableItems = data.result.filter(item => {
                const url = typeof item === 'string' ? item : (item.image || item.url || item.download);
                return url && !postedUrls.has(url);
            });

            if (availableItems.length === 0) {
                postedUrls.clear();
                availableItems = data.result;
            }

            const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];

            const imageUrl = typeof randomItem === 'string' 
                ? randomItem 
                : (randomItem.image || randomItem.url || randomItem.download || randomItem.link);

            const title = (randomItem && typeof randomItem === 'object' && randomItem.title) 
                ? randomItem.title 
                : 'Ultra HD 4K Wallpaper';

            if (!imageUrl) return;

            postedUrls.add(imageUrl);

            const caption = `┏━━━〔 🖼️ 𝟰𝗞 𝗪𝗔𝗟𝗟𝗣𝗔𝗣𝗘𝗥 〕━━━┓\n` +
                            `┃\n` +
                            `┃  📌 *Title* ⌁ ${title}\n` +
                            `┃  ✨ *Quality* ⌁ Ultra HD 4K\n` +
                            `┃  ⏰ *Auto Post* ⌁ Every 5 Mins\n` +
                            `┃\n` +
                            `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                            `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

            await sock.sendMessage(CHANNEL_JID, {
                image: { url: imageUrl },
                caption: caption
            });

            console.log(`✅ [AUTO-WALLPAPER] Posted to Channel: ${title}`);

        } catch (err) {
            console.error('❌ [AUTO-WALLPAPER] Error:', err.message);
        }
    };

    // Bot run වූ සැනින් සහ විනාඩි 5න් 5ට
    sendRandomWallpaper();
    setInterval(sendRandomWallpaper, 5 * 60 * 1000);
}

module.exports = { startAutoWallpaper };

