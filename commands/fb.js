// commands/fb.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

module.exports = {
    name: 'fb',
    alias: ['facebook', 'fbdl'],
    category: 'download',
    desc: 'Download Facebook Videos Error-Free',

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
        let tempFilePath = null;

        try {
            sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

            loadMsg = await sock.sendMessage(targetChat, { 
                text: `*⚡ DOWNLOADING FACEBOOK MEDIA ⚡*\n\n⏳ _වීඩියෝව සකසමින් පවතී, කරුණාකර රැඳී සිටින්න..._${DEFAULT_FOOTER}` 
            }, { quoted: msg });

            let finalDownloadUrl = null;
            let videoTitle = "Facebook Video";

            // ⚡ Optimized Fast Multi-API Extraction
            const fetchMethods = [
                // SupunOFC API
                async () => {
                    const apiKey = 'supun-tvo5olfxylo98b8l6b9lq174';
                    const apiUrl = `https://supunofc.site/api/download/facebook/dl?url=${encodeURIComponent(cleanUrl)}&apikey=${apiKey}`;
                    const res = await axios.get(apiUrl, { timeout: 8000 });
                    const medias = res.data?.result?.medias;
                    if (res.data?.success && medias?.length > 0) {
                        const hd = medias.find(m => m.quality === 'hd' && m.videoAvailable);
                        const sd = medias.find(m => m.quality === 'sd' && m.videoAvailable);
                        return {
                            url: (hd || sd || medias[0])?.url,
                            title: res.data?.result?.title || "Facebook Video"
                        };
                    }
                    throw new Error('Supun failed');
                },
                // David Cyril API
                async () => {
                    const res = await axios.get(`https://api.davidcyriltech.my.id/facebook?url=${encodeURIComponent(cleanUrl)}`, { timeout: 7000 });
                    if (res.data?.success && res.data?.result) {
                        return {
                            url: res.data.result.hd || res.data.result.sd,
                            title: res.data.result.title || "Facebook Video"
                        };
                    }
                    throw new Error('David Cyril failed');
                },
                // NexOracle FB API
                async () => {
                    const res = await axios.get(`https://api.nexoracle.com/downloader/facebook?apikey=free_key@maher_apis&url=${encodeURIComponent(cleanUrl)}`, { timeout: 7000 });
                    if (res.data?.status === 200 && res.data?.result) {
                        return {
                            url: res.data.result.hd || res.data.result.sd,
                            title: res.data.result.title || "Facebook Video"
                        };
                    }
                    throw new Error('NexOracle failed');
                },
                // Widipe API
                async () => {
                    const res = await axios.get(`https://widipe.com/download/fbdl?url=${encodeURIComponent(cleanUrl)}`, { timeout: 7000 });
                    if (res.data?.status === 200 && res.data?.result) {
                        return {
                            url: res.data.result.hd || res.data.result.sd,
                            title: "Facebook Video"
                        };
                    }
                    throw new Error('Widipe failed');
                }
            ];

            for (const method of fetchMethods) {
                try {
                    const result = await method();
                    if (result?.url) {
                        finalDownloadUrl = result.url;
                        if (result.title) videoTitle = result.title;
                        break;
                    }
                } catch (e) {}
            }

            if (!finalDownloadUrl) {
                throw new Error('වීඩියෝ Link එක ලබා ගැනීමට නොහැකි විය. වීඩියෝව Private එකක් විය හැක.');
            }

            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            tempFilePath = path.join(tempDir, `fb_${Date.now()}.mp4`);

            // Safe Non-Blocking Stream Pipeline
            const response = await axios({
                method: 'GET',
                url: finalDownloadUrl,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                },
                timeout: 45000
            });

            await pipeline(response.data, fs.createWriteStream(tempFilePath));

            const stats = await fs.promises.stat(tempFilePath);
            if (stats.size < 10000) {
                throw new Error('ලබාගත් වීඩියෝව වාදනය කළ නොහැකි එකකි (Corrupted File).');
            }

            if (loadMsg) {
                sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
            }

            const caption = `*📘 𝗙𝗔𝗖𝗘𝗕𝗢𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📘*\n\n📌 *Title:* ${videoTitle}${DEFAULT_FOOTER}`;

            // ⚡ Ultra-fast direct file upload without RAM buffering
            await sock.sendMessage(targetChat, {
                video: { url: tempFilePath },
                caption: caption,
                mimetype: 'video/mp4',
                fileName: 'fb_video.mp4'
            }, { quoted: msg });

            sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (err) {
            console.error('FB Final DL Error:', err.message);
            if (loadMsg) sock.sendMessage(targetChat, { delete: loadMsg.key }).catch(() => {});
            sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            await sock.sendMessage(targetChat, { 
                text: `❌ *Facebook Download Error:* ${err.message}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        } finally {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.promises.unlink(tempFilePath).catch(() => {});
            }
        }
    }
};

