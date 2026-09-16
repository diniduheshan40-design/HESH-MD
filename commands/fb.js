// commands/fb.js
const axios = require('axios');

module.exports = {
    name: 'fb',
    alias: ['facebook'],
    category: 'download',
    desc: 'Download Facebook Videos with Multi-Fallback & Error Prevention',

    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const rawUrl = args[0];

        if (!rawUrl || (!rawUrl.includes('facebook.com') && !rawUrl.includes('fb.watch'))) {
            return await sock.sendMessage(targetChat, { 
                text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර නිවැරදි Facebook වීඩියෝ link එකක් ඇතුළත් කරන්න!*\n\n📘 *උදාහරණ:*\n• .fb https://www.facebook.com/watch?v=xxxx\n• .facebook https://fb.watch/xxxx/${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        const cleanUrl = rawUrl.trim();
        let loadMsg = null;

        try {
            await sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

            // 1. Loading Message
            loadMsg = await sock.sendMessage(targetChat, { 
                text: `*⚡ DOWNLOADING FACEBOOK MEDIA ⚡*\n\n⏳ _කරුණාකර මොහොතක් රැඳී සිටින්න, වීඩියෝව සකසමින් පවතී..._${DEFAULT_FOOTER}` 
            }, { quoted: msg });

            let videoUrl = null;
            let videoTitle = "Facebook Video";
            let qualityTag = "HD";

            // 2. Chamindu API (Enhanced validation against yt-dlp errors)
            try {
                const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
                const chamRes = await axios.get(`https://api.chamindu.site/api/v1/facebook?url=${encodeURIComponent(cleanUrl)}&api_key=${API_KEY}`, { 
                    timeout: 12000,
                    validateStatus: () => true 
                });

                const root = chamRes.data || {};
                const data = root.data || {};
                const hasErrorMsg = typeof root.message === 'string' && root.message.toLowerCase().includes('failed');

                if (!hasErrorMsg && data.status !== 'inaccessible_or_private') {
                    const candidateUrl = data.fast_download_hd || data.hd || data.fast_download || data.fast_download_sd || data.sd;
                    if (candidateUrl && candidateUrl.startsWith('http')) {
                        videoUrl = candidateUrl;
                        if (data.title && !data.title.includes(':')) videoTitle = data.title;
                    }
                }
            } catch (e) {}

            // 3. Fallback API 1 (Dorratz)
            if (!videoUrl) {
                try {
                    const fallbackRes = await axios.get(`https://api.dorratz.com/v2/fb-dl?url=${encodeURIComponent(cleanUrl)}`, { 
                        timeout: 12000 
                    });
                    if (fallbackRes.data?.status && Array.isArray(fallbackRes.data?.data) && fallbackRes.data.data.length > 0) {
                        const dlObj = fallbackRes.data.data.find(v => v.quality?.includes('720') || v.quality?.includes('HD')) || fallbackRes.data.data[0];
                        if (dlObj?.url && dlObj.url.startsWith('http')) {
                            videoUrl = dlObj.url;
                        }
                    }
                } catch (e) {}
            }

            // 4. Fallback API 2 (GiftedTech)
            if (!videoUrl) {
                try {
                    const giftRes = await axios.get(`https://api.giftedtech.web.id/api/download/facebook?apikey=gifted&url=${encodeURIComponent(cleanUrl)}`, { 
                        timeout: 12000 
                    });
                    if (giftRes.data?.success && giftRes.data?.result) {
                        const target = giftRes.data.result.hd || giftRes.data.result.sd;
                        if (target && target.startsWith('http')) {
                            videoUrl = target;
                            if (giftRes.data.result.title) videoTitle = giftRes.data.result.title;
                        }
                    }
                } catch (e) {}
            }

            // 5. Fallback API 3 (Vinez API)
            if (!videoUrl) {
                try {
                    const vinezRes = await axios.get(`https://api.vinez.my.id/api/download/facebook?url=${encodeURIComponent(cleanUrl)}`, { 
                        timeout: 12000 
                    });
                    if (vinezRes.data?.status && (vinezRes.data?.hd || vinezRes.data?.sd)) {
                        videoUrl = vinezRes.data.hd || vinezRes.data.sd;
                    }
                } catch (e) {}
            }

            // කිසිම API එකකින් direct link එක නොලැබුණහොත්
            if (!videoUrl) {
                if (loadMsg) await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
                await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *මෙම වීඩියෝව බාගත කළ නොහැක!*\n\n_හේතුව: වීඩියෝව Private එකක් විය හැක, නැතහොත් Facebook සර්වර් මඟින් Download links අවහිර කර ඇත._${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            // 6. Direct Buffer Download with Validation
            const videoRes = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                },
                timeout: 60000
            });

            const videoBuffer = Buffer.from(videoRes.data);

            // Payload එක HTML/Text error එකක්ද සහ ප්‍රමාණය ප්‍රමාණවත්දැයි පරීක්ෂාව
            const checkHeader = videoBuffer.slice(0, 100).toString('utf8').toLowerCase();
            if (checkHeader.includes('<!doctype') || checkHeader.includes('<html') || videoBuffer.length < 50000) {
                throw new Error('බාගත වූ දත්ත වීඩියෝ ගොනුවක් නොවේ (Stream Corrupted).');
            }

            // 7. Delete Loading Message
            if (loadMsg) {
                await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
            }

            // 8. Send Video
            const caption = `*📘 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📘*\n\n📌 *Title:* ${videoTitle}\n📊 *Quality:* ${qualityTag}${DEFAULT_FOOTER}`;

            await sock.sendMessage(targetChat, {
                video: videoBuffer,
                caption: caption,
                mimetype: 'video/mp4',
                fileName: 'facebook_video.mp4'
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

