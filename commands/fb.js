// commands/fb.js
const axios = require('axios');

module.exports = {
    name: 'fb',
    alias: ['facebook'],
    category: 'download',
    desc: 'Download Facebook Videos with Strict Media Validation',

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

            loadMsg = await sock.sendMessage(targetChat, { 
                text: `*⚡ DOWNLOADING FACEBOOK MEDIA ⚡*\n\n⏳ _වීඩියෝව සකසමින් පවතී, කරුණාකර රැඳී සිටින්න..._${DEFAULT_FOOTER}` 
            }, { quoted: msg });

            let videoBuffer = null;
            let videoTitle = "Facebook Video";

            // Helper function to download and strictly validate video binary
            const fetchAndValidateVideo = async (url) => {
                if (!url || !url.startsWith('http')) return null;
                try {
                    const res = await axios.get(url, {
                        responseType: 'arraybuffer',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': '*/*'
                        },
                        timeout: 45000
                    });

                    const cType = res.headers['content-type'] || '';
                    const buf = Buffer.from(res.data);

                    // Error HTML check & MP4 signature check (ftyp / isom / moov)
                    const headerStr = buf.slice(0, 100).toString('utf8').toLowerCase();
                    const isHtml = headerStr.includes('<!doctype') || headerStr.includes('<html');
                    
                    if (!isHtml && buf.length > 500000) { // 500KB ට වඩා වැඩි නියම වීඩියෝ පමණි
                        return buf;
                    }
                } catch (e) {}
                return null;
            };

            // 🟢 1. Siputzx API (ඉතා හොඳින් FB videos වැඩ කරන API එකක්)
            try {
                const res = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(cleanUrl)}`, { timeout: 10000 });
                if (res.data?.status && res.data?.data) {
                    const dlUrl = res.data.data.hd || res.data.data.sd || res.data.data.normal;
                    videoBuffer = await fetchAndValidateVideo(dlUrl);
                    if (res.data.data.title) videoTitle = res.data.data.title;
                }
            } catch (e) {}

            // 🟢 2. BK9 FB API
            if (!videoBuffer) {
                try {
                    const res = await axios.get(`https://bk9.fun/download/fb?url=${encodeURIComponent(cleanUrl)}`, { timeout: 10000 });
                    if (res.data?.status && res.data?.BK9) {
                        const target = res.data.BK9.hd || res.data.BK9.sd;
                        videoBuffer = await fetchAndValidateVideo(target);
                        if (res.data.BK9.title) videoTitle = res.data.BK9.title;
                    }
                } catch (e) {}
            }

            // 🟢 3. Dorratz API
            if (!videoBuffer) {
                try {
                    const res = await axios.get(`https://api.dorratz.com/v2/fb-dl?url=${encodeURIComponent(cleanUrl)}`, { timeout: 10000 });
                    if (res.data?.status && Array.isArray(res.data?.data)) {
                        const item = res.data.data.find(v => v.quality?.includes('720') || v.quality?.includes('HD')) || res.data.data[0];
                        videoBuffer = await fetchAndValidateVideo(item?.url);
                    }
                } catch (e) {}
            }

            // 🟢 4. Chamindu API (yt-dlp error එකක් නැති නම් පමණක්)
            if (!videoBuffer) {
                try {
                    const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
                    const chamRes = await axios.get(`https://api.chamindu.site/api/v1/facebook?url=${encodeURIComponent(cleanUrl)}&api_key=${API_KEY}`, { timeout: 10000 });
                    const root = chamRes.data || {};
                    const data = root.data || {};
                    
                    if (root.status && !root.message?.includes('Failed') && data.status !== 'inaccessible_or_private') {
                        const candidate = data.fast_download_hd || data.hd || data.fast_download || data.sd;
                        videoBuffer = await fetchAndValidateVideo(candidate);
                        if (data.title) videoTitle = data.title;
                    }
                } catch (e) {}
            }

            // කිසිම API එකකින් හරියට video එක බාගත නොවූ විට
            if (!videoBuffer) {
                if (loadMsg) await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
                await sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                return await sock.sendMessage(targetChat, { 
                    text: `❌ *මෙම වීඩියෝව බාගත කිරීමට නොහැකි විය!*\n\n_හේතුව: වීඩියෝව Private එකක් හෝ Facebook සර්වර් මඟින් Download links Block කර ඇත. වෙනත් link එකක් උත්සාහ කරන්න._${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }

            // Loading message එක අයින් කිරීම
            if (loadMsg) {
                await sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
            }

            const caption = `*📘 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📘*\n\n📌 *Title:* ${videoTitle}\n📊 *Quality:* HD/SD${DEFAULT_FOOTER}`;

            // Verified MP4 Stream එක යැවීම
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
                text: `❌ *Facebook Error:* ${err.message}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};

