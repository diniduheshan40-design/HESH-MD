// commands/fb.js
const axios = require('axios');

module.exports = {
    name: 'fb',
    alias: ['facebook'],
    category: 'download',
    desc: 'Download Facebook Videos with Validation & Auto-Delete',

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

            // 🟢 1. Loading Message
            loadMsg = await sock.sendMessage(targetChat, { 
                text: `*⚡ DOWNLOADING FACEBOOK MEDIA ⚡*\n\n⏳ _කරුණාකර මොහොතක් රැඳී සිටින්න, වීඩියෝව සකසමින් පවතී..._${DEFAULT_FOOTER}` 
            }, { quoted: msg });

            let videoUrl = null;
            let videoTitle = "Facebook Video";
            let qualityTag = "HD";

            // 🟢 2. Chamindu API First Try (Strict Check)
            try {
                const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
                const chamRes = await axios.get(`https://api.chamindu.site/api/v1/facebook?url=${encodeURIComponent(url.trim())}&api_key=${API_KEY}`, { timeout: 15000 });
                const chamData = chamRes.data?.data || chamRes.data;

                // Status එක inaccessible_or_private නොවේ නම් පමණක් URL ලබාගැනීම
                if (chamData?.status !== 'inaccessible_or_private') {
                    videoUrl = chamData?.fast_download_hd || chamData?.hd || chamData?.fast_download || chamData?.fast_download_sd || chamData?.sd;
                    if (chamData?.title && !chamData.title.includes(':')) videoTitle = chamData.title;
                }
            } catch (e) {}

            // 🟢 3. Fallback API 1 (Dorratz Free Public API)
            if (!videoUrl) {
                try {
                    const fallbackRes = await axios.get(`https://api.dorratz.com/v2/fb-dl?url=${encodeURIComponent(url.trim())}`, { timeout: 15000 });
                    if (fallbackRes.data?.status && fallbackRes.data?.data) {
                        const dlObj = fallbackRes.data.data.find(v => v.quality?.includes('720') || v.quality?.includes('HD')) || fallbackRes.data.data[0];
                        videoUrl = dlObj?.url;
                    }
                } catch (e) {}
            }

            // 🟢 4. Fallback API 2 (GiftedTech API)
            if (!videoUrl) {
                try {
                    const giftRes = await axios.get(`https://api.giftedtech.web.id/api/download/facebook?apikey=gifted&url=${encodeURIComponent(url.trim())}`, { timeout: 15000 });
                    if (giftRes.data?.success && giftRes.data?.result) {
                        videoUrl = giftRes.data.result.hd || giftRes.data.result.sd;
                        if (giftRes.data.result.title) videoTitle = giftRes.data.result.title;
                    }
                } catch (e) {}
            }

            // කිසිම API එකකින් වීඩියෝව නොලැබුණහොත්
            if (!videoUrl) {
                if (loadMsg) await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
                await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *මෙම වීඩියෝව බාගත කළ නොහැක!*\n\n_හේතුව: වීඩියෝව Private එකක් හෝ Facebook විසින් Download links අවහිර කර ඇත._${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            const caption = `*📘 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📘*\n\n📌 *Title:* ${videoTitle}\n📊 *Quality:* ${qualityTag}${DEFAULT_FOOTER}`;

            // 🟢 5. Binary Stream Download & Verify
            const videoRes = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.facebook.com/'
                },
                timeout: 60000
            });

            const videoBuffer = Buffer.from(videoRes.data);

            // 861 KB වගේ කුඩා HTML Error Pages වැළැක්වීම (Minimum 1MB check)
            const checkHeader = videoBuffer.slice(0, 100).toString('utf8');
            if (checkHeader.includes('<!DOCTYPE') || checkHeader.includes('<html') || videoBuffer.length < 100000) {
                throw new Error('Corrupted or inaccessible video stream.');
            }

            // 🟢 6. Loading Message එක Delete කිරීම
            if (loadMsg) {
                await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
            }

            // 🟢 7. Playable Video එක යැවීම
            await sock.sendMessage(targetChat, {
                video: videoBuffer,
                caption: caption,
                mimetype: 'video/mp4',
                fileName: 'facebook_video.mp4',
                ptv: false
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

