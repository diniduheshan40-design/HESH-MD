// lib/tiktokHelper.js
const axios = require('axios');

const API_KEY = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';

async function getDirectVideoUrl(dlApiUrl) {
    try {
        const res = await axios.get(dlApiUrl, { timeout: 15000 });
        // Chamindu DL endpoint එකෙන් direct video url එකක් දෙනවා නම්
        if (res.data?.data?.video || res.data?.video || res.data?.url || res.data?.result?.video) {
            return res.data?.data?.video || res.data?.video || res.data?.url || res.data?.result?.video;
        }
        // කෙලින්ම URL එකක් ආවොත්
        if (typeof res.data === 'string' && res.data.startsWith('http')) {
            return res.data;
        }
    } catch (e) {}
    return null;
}

async function fetchTikTokMedia(query = 'mrbeast') {
    try {
        const searchUrl = `https://api.chamindu.site/api/v1/tiktok?q=${encodeURIComponent(query)}&api_key=${API_KEY}`;
        const searchRes = await axios.get(searchUrl, { timeout: 15000 });

        const results = searchRes.data?.data?.results || searchRes.data?.results || [];
        const videoList = results.filter(v => v.is_video);

        if (videoList.length === 0) return null;

        // Random video එකක් තෝරා ගැනීම
        const item = videoList[Math.floor(Math.random() * videoList.length)];
        let targetDownloadUrl = null;

        // 1. dl link එකෙන් direct mp4 url එක සොයා ගැනීම
        if (item.dl) {
            targetDownloadUrl = await getDirectVideoUrl(item.dl);
        }

        // 2. නැතිනම් download_api එකෙන් උත්සාහ කිරීම
        if (!targetDownloadUrl && item.download_api) {
            targetDownloadUrl = await getDirectVideoUrl(item.download_api);
        }

        // 3. ඒ දෙකම බැරි උනොත් direct dl එකටම try කිරීම
        if (!targetDownloadUrl && item.dl) {
            targetDownloadUrl = item.dl;
        }

        if (!targetDownloadUrl) return null;

        // Video buffer එක download කිරීම
        const videoBufferRes = await axios.get(targetDownloadUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        const buffer = Buffer.from(videoBufferRes.data);
        
        // Video file එකක්දැයි තහවුරු කරගැනීම (HTML හෝ JSON නම් drop කිරීම)
        if (buffer.length < 50000) { // 50KB ට වඩා අඩු නම් corrupt/error එකක්
            return null;
        }

        return {
            buffer,
            title: item.title || 'Trending TikTok Video',
            author: item.author || '@mrbeast'
        };
    } catch (err) {
        console.error('❌ [TIKTOK-HELPER-ERROR]:', err.message);
        return null;
    }
}

module.exports = { fetchTikTokMedia };

