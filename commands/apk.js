// commands/apk.js
const axios = require('axios');

module.exports = {
    name: 'apk',
    alias: ['an1', 'apkdl'],
    category: 'download',
    desc: 'Download APK files from AN1',

    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const url = args[0];

        if (!url || !url.includes('an1.com')) {
            return await sock.sendMessage(targetChat, { 
                text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර නිවැරදි AN1 Link එකක් ඇතුළත් කරන්න!*\n\n📦 *Example:*\n• .apk https://an1.com/936-djay-2.html${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        // Instant Reaction
        sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

        const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
        const apiUrl = `https://api.chamindu.site/api/v1/apk/an1/infodl?q=${encodeURIComponent(url.trim())}&api_key=${API_KEY}`;

        try {
            const res = await axios.get(apiUrl, { timeout: 15000 });
            const data = res.data?.data;

            if (!data || !Array.isArray(data.downloads) || data.downloads.length === 0) {
                sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *APK තොරතුරු ලබා ගැනීමට නොහැකි විය. Link එක නිවැරදි දැයි පරීක්ෂා කරන්න!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            // Direct .apk link extraction
            const apkItem = data.downloads.find(d => d.direct_link && d.direct_link.endsWith('.apk')) || data.downloads[0];

            if (!apkItem || !apkItem.direct_link) {
                sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *Download කරගත හැකි APK Link එකක් හමු නොවීය!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const title = data.title || "Android App";
            const cleanTitle = title.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = apkItem.name 
                ? apkItem.name.replace(/[^a-zA-Z0-9._-]/g, '_') 
                : `${cleanTitle}.apk`;

            const sizeMatch = apkItem.name?.match(/\d+(\.\d+)?\s*(Mb|MB|Gb|GB|Kb|KB)/i)?.[0] || 'Unknown';

            // Send APK document with full details in caption (Faster single-message delivery)
            const captionText = `*📦 𝗔𝗣𝗞 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥 📦*\n\n` +
                                `📌 *Name:* ${title}\n` +
                                `📁 *File:* ${fileName}\n` +
                                `🔗 *Size:* ${sizeMatch}\n\n` +
                                `✅ *Download Completed!*${DEFAULT_FOOTER}`;

            await sock.sendMessage(targetChat, {
                document: { url: apkItem.direct_link },
                fileName: fileName.endsWith('.apk') ? fileName : `${fileName}.apk`,
                mimetype: 'application/vnd.android.package-archive',
                caption: captionText
            }, { quoted: msg });

            sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('APK DL Error:', err.message);
            sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ *APK Download Error:* සර්වර් එක කාර්යබහුලයි හෝ Link එක කල් ඉකුත් වී ඇත.${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};
