// commands/fb.js
const axios = require('axios');

module.exports = {
    name: 'fb',
    alias: ['facebook'],
    category: 'download',
    desc: 'Download Facebook Videos with Auto-Delete Notification',

    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const url = args[0];

        if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
            return await sock.sendMessage(targetChat, { 
                text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර Facebook වීඩියෝ link එකක් ඇතුළත් කරන්න!*\n\n📘 *Example:*\n• .fb https://www.facebook.com/watch?v=xxxx\n• .facebook https://fb.watch/xxxx/${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        let loadMsg = null;

        try {
            await sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

            // 🟢 1. Loading Message එක යැවීම
            loadMsg = await sock.sendMessage(targetChat, { 
                text: `*⚡ DOWNLOADING FACEBOOK MEDIA ⚡*\n\n⏳ _කරුණාකර මොහොතක් රැඳී සිටින්න, වීඩියෝව සකසමින් පවතී..._${DEFAULT_FOOTER}` 
            }, { quoted: msg });

            let videoUrl = null;
            let videoTitle = "Facebook Video";
            let qualityTag = "HD";

            // 🟢 Primary API: GiftedTech API
            try {
                const res1 = await axios.get(`https://api.giftedtech.web.id/api/download/facebook?apikey=gifted&url=${encodeURIComponent(url.trim())}`, { timeout: 20000 });
                if (res1.data?.success && res1.data?.result) {
                    videoUrl = res1.data.result.hd || res1.data.result.sd;
                    videoTitle = res1.data.result.title || videoTitle;
                }
            } catch (e1) {}

            // 🟢 Fallback API 1: Betabotz / Dorratz
            if (!videoUrl) {
                try {
                    const res2 = await axios.get(`https://api.dorratz.com/v2/fb-dl?url=${encodeURIComponent(url.trim())}`, { timeout: 20000 });
                    if (res2.data?.data) {
                        videoUrl = res2.data.data.find(v => v.quality?.includes('720') || v.quality?.includes('HD'))?.url || res2.data.data[0]?.url;
                    }
                } catch (e2) {}
            }

            // 🟢 Fallback API 2: Chamindu Site API
            if (!videoUrl) {
                try {
                    const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
                    const res3 = await axios.get(`https://api.chamindu.site/api/v1/facebook?url=${encodeURIComponent(url.trim())}&api_key=${API_KEY}`, { timeout: 20000 });
                    const data3 = res3.data?.data || res3.data;
                    videoUrl = data3?.hd || data3?.fast_download_hd || data3?.sd || data3?.fast_download;
                    if (data3?.title && !data3.title.includes(':')) videoTitle = data3.title;
                } catch (e3) {}
            }

            if (!videoUrl) {
                if (loadMsg) await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
                await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *වීඩියෝව ලබාගත නොහැකි විය. වීඩියෝව Public එකක් දැයි තහවුරු කරගන්න!*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const caption = `*📘 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📘*\n\n📌 *Title:* ${videoTitle}\n📊 *Quality:* ${qualityTag}${DEFAULT_FOOTER}`;

            // 🟢 2. Stream Buffer Validation
            const videoRes = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8'
                },
                timeout: 60000
            });

            const videoBuffer = Buffer.from(videoRes.data);

            // 🟢 3. HTML Error Page එකක් Buffer එකට ආවාදැයි පරීක්ෂාව
            const checkHeader = videoBuffer.slice(0, 50).toString('utf8');
            if (checkHeader.includes('<!DOCTYPE') || checkHeader.includes('<html')) {
                throw new Error('CDN returned HTML page instead of video binary');
            }

            // 🟢 4. Loading Message එක Auto-Delete කිරීම
            if (loadMsg) {
                await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
            }

            // 🟢 5. Valid Playable Video එක යැවීම
            await sock.sendMessage(targetChat, {
                video: videoBuffer,
                caption: caption,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            await sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('FB DL Error:', err.message);
            if (loadMsg) await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
            await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ *Facebook Download Error:* ${err.message}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};
