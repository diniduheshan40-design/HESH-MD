// lib/tiktokHelper.js
const axios = require('axios');

const CHAMINDU_API_KEY = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';

// 🟢 TikWM / Fallback හරහා සැබෑ MP4 URL එක ලබාගැනීම
async function resolveDirectVideo(tiktokWebUrl) {
    // Method 1: TikWM Direct Downloader (100% Reliable, No Watermark)
    try {
        const res = await axios.post('https://www.tikwm.com/api/', 
            new URLSearchParams({ url: tiktokWebUrl, hd: '1' }), 
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000
            }
        );
        const playUrl = res.data?.data?.play || res.data?.data?.wmplay;
        if (playUrl) return playUrl.startsWith('http') ? playUrl : `https://www.tikwm.com${playUrl}`;
    } catch (e) {}

    // Method 2: TikWM GET Endpoint
    try {
        const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokWebUrl)}`, { timeout: 15000 });
        const playUrl = res.data?.data?.play || res.data?.data?.wmplay;
        if (playUrl) return playUrl.startsWith('http') ? playUrl : `https://www.tikwm.com${playUrl}`;
    } catch (e) {}

    return null;
}

// 🟢 Chamindu Search API එකෙන් Results ගෙන Video Buffer එක සකස් කිරීම
async function fetchTikTokMedia(query = 'mrbeast') {
    try {
        const searchUrl = `https://api.chamindu.site/api/v1/tiktok?q=${encodeURIComponent(query)}&api_key=${CHAMINDU_API_KEY}`;
        const searchRes = await axios.get(searchUrl, { timeout: 15000 });

        const results = searchRes.data?.data?.results || searchRes.data?.results || [];
        const videoList = results.filter(v => v.is_video && v.url && v.url.includes('/video/'));

        if (videoList.length === 0) {
            console.log('⚠️ [TIKTOK-HELPER] No valid videos found in search response.');
            return null;
        }

        // Random Video එකක් තෝරාගැනීම
        const selected = videoList[Math.floor(Math.random() * videoList.length)];
        const directMp4Url = await resolveDirectVideo(selected.url);

        if (!directMp4Url) {
            console.log('⚠️ [TIKTOK-HELPER] Could not resolve direct MP4 URL.');
            return null;
        }

        // වීඩියෝව Buffer එකක් ලෙස Download කිරීම
        const videoBufferRes = await axios.get(directMp4Url, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const buffer = Buffer.from(videoBufferRes.data);

        // අවම 50KB වත් තිබිය යුතුය
        if (buffer.length < 50000) return null;

        return {
            buffer,
            title: selected.title || 'Trending TikTok Video',
            author: selected.author || '@tiktok'
        };

    } catch (err) {
        console.error('❌ [TIKTOK-HELPER-ERROR]:', err.message);
        return null;
    }
}

module.exports = { fetchTikTokMedia };
