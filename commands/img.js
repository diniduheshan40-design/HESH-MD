// commands/img.js
const axios = require('axios');

module.exports = {
    name: 'img',
    alias: ['image', 'gimage'],
    category: 'download',
    desc: 'Search and download Google images',

    async execute(sock, msg, args, chatJid) {
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const rawText = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || 
                         msg.message?.imageMessage?.caption || "";

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

        // Fast Non-blocking Reaction
        sock.sendMessage(targetChat, { react: { text: "🔍", key: msg.key } }).catch(() => {});

        try {
            const apiKey = 'supun-tvo5olfxylo98b8l6b9lq174';
            const apiUrl = `https://supunofc.site/api/search/google-image-search/search?q=${encodeURIComponent(query)}&apikey=${apiKey}`;

            // ⚡ 8s Fast Network Timeout
            const response = await axios.get(apiUrl, { timeout: 8000 });
            const data = response.data;

            if (!data?.success || !Array.isArray(data.result) || data.result.length === 0) {
                sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *${query}* සඳහා කිසිදු පින්තූරයක් හමු නොවීය.` 
                }, { quoted: msg });
            }

            sock.sendMessage(targetChat, { react: { text: "📸", key: msg.key } }).catch(() => {});

            // Filter out valid image URLs
            const validImages = data.result
                .map(item => (typeof item === 'string' ? item : item?.url || item?.image))
                .filter(url => typeof url === 'string' && url.startsWith('http'))
                .slice(0, 3);

            if (validImages.length === 0) {
                throw new Error('Valid image links not found');
            }

            // ⚡ Parallel Image Dispatching with Fallback Safety
            await Promise.allSettled(
                validImages.map((imageUrl, index) => {
                    const caption = `┏━━━〔 🖼️ 𝐆𝐎𝐎𝐆𝐋𝐄 𝐈𝐌𝐀𝐆𝐄 〕━━━┓\n` +
                                    `┃\n` +
                                    `┃  🔍 *Query* ⌁ ${query}\n` +
                                    `┃  📸 *Image* ⌁ ${index + 1}/${validImages.length}\n` +
                                    `┃\n` +
                                    `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                                    `> 🔐 *heshan ofc • all rights reserved*`;

                    return sock.sendMessage(targetChat, {
                        image: { url: imageUrl },
                        caption: caption
                    }, { quoted: msg }).catch(() => {});
                })
            );

        } catch (err) {
            console.error("Image Command Error:", err?.message || err);
            sock.sendMessage(targetChat, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: '⚠️ පින්තූර ලබා ගැනීමේදී දෝෂයක් ඇති විය. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.' 
            }, { quoted: msg });
        }
    }
};
