// commands/img.js
const axios = require('axios');

module.exports = {
    name: 'img',
    category: 'download',
    desc: 'Search and download Google images',

    async execute(sock, msg, args, chatJid) {
        // Target chat එක සහ sender හඳුනා ගැනීම
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        // Message එකෙන් text එක ලබා ගැනීම
        const rawText = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || 
                         msg.message?.imageMessage?.caption || "";

        // Query එක ලබා ගැනීම (args හරහා හෝ rawText එකෙන්)
        let query = args && args.length > 0 ? args.join(' ') : "";
        if (!query && rawText) {
            const parts = rawText.trim().split(/\s+/);
            if (parts.length > 1) query = parts.slice(1).join(' ');
        }

        if (!query) {
            return await sock.sendMessage(targetChat, { 
                text: '⚠️ කරුණාකර සෙවිය යුතු පින්තූරයේ නම ඇතුළත් කරන්න!\n\nඋදාහරණ: *.img cute cat*' 
            }, { quoted: msg });
        }

        // Processing reaction එකක් දැමීම
        sock.sendMessage(targetChat, { react: { text: "🔍", key: msg.key } }).catch(() => {});

        try {
            const apiKey = 'supun-tvo5olfxylo98b8l6b9lq174';
            const apiUrl = `https://supunofc.site/api/search/google-image-search/search?q=${encodeURIComponent(query)}&apikey=${apiKey}`;

            const response = await axios.get(apiUrl);
            const data = response.data;

            if (!data.success || !data.result || data.result.length === 0) {
                sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *${query}* සඳහා කිසිදු පින්තූරයක් හමු නොවීය.` 
                }, { quoted: msg });
            }

            // සාර්ථක වූ විට Reaction එකක්
            sock.sendMessage(targetChat, { react: { text: "📸", key: msg.key } }).catch(() => {});

            // මුල් පින්තූර 3ක් යැවීම (අවශ්‍ය නම් සංඛ්‍යාව වෙනස් කළ හැක)
            const count = Math.min(data.result.length, 3);

            for (let i = 0; i < count; i++) {
                const imageUrl = data.result[i];
                const caption = `┏━━━〔 🖼️ 𝐆𝐎𝐎𝐆𝐋𝐄 𝐈𝐌𝐀𝐆𝐄 〕━━━┓\n` +
                                `┃\n` +
                                `┃  🔍 *Query* ⌁ ${query}\n` +
                                `┃  📸 *Image* ⌁ ${i + 1}/${count}\n` +
                                `┃\n` +
                                `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                                `> 🔐 *heshan ofc • all rights reserved*`;

                await sock.sendMessage(targetChat, {
                    image: { url: imageUrl },
                    caption: caption
                }, { quoted: msg });
            }

        } catch (err) {
            console.error("Image Command Error:", err.message);
            sock.sendMessage(targetChat, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: '⚠️ පින්තූර ලබා ගැනීමේදී දෝෂයක් ඇති විය. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.' 
            }, { quoted: msg });
        }
    }
};
