// commands/insta.js
const axios = require('axios');
let gifted;
try {
    gifted = require('gifted-dls');
} catch (e) {}

module.exports = {
    name: 'insta',
    alias: ['ig', 'reels', 'igdl'],
    category: 'download',
    desc: 'Download Instagram Reels and Videos using KCeY API',

    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        const rawText = msg.message?.conversation || 
                        msg.message?.extendedTextMessage?.text || 
                        args.join(' ');

        // URL එක Extract කරගැනීම
        const match = rawText.match(/https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p|reel|tv|share)\/[A-Za-z0-9_-]+/i);

        if (!match) {
            return await sock.sendMessage(targetChat, { 
                text: `*❪ ERROR ❫*\n\n⚠️ *කරුණාකර Instagram Reel හෝ Video ලින්ක් එකක් ඇතුළත් කරන්න!*\n\n📸 *Example:*\n• .insta https://www.instagram.com/reel/xxxxxx/${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        const cleanUrl = match[0];
        sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

        let downloadUrl = null;
        let isVideo = true;

        // ⚡ Method 1: KCeY Worker API (instadl.kcey.workers.dev)
        try {
            const workerUrl = `https://instadl.kcey.workers.dev/?url=${encodeURIComponent(cleanUrl)}`;
            const res = await axios.get(workerUrl, { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            const data = res.data;

            // Worker API JSON structure parsing
            if (data?.status === "success" || data?.status === true || data?.result || data?.data) {
                const mediaData = data.result || data.data || data.media || data;

                if (Array.isArray(mediaData) && mediaData.length > 0) {
                    downloadUrl = mediaData[0]?.url || mediaData[0]?.download_url || mediaData[0];
                } else if (typeof mediaData === 'object') {
                    downloadUrl = mediaData.url || mediaData.download || mediaData.video || mediaData.link;
                } else if (typeof mediaData === 'string') {
                    downloadUrl = mediaData;
                }
            } else if (data?.url) {
                downloadUrl = data.url;
            }
        } catch (e) {
            console.log("KCeY API Error, Switching to fallback...");
        }

        // ⚡ Method 2: Gifted-DLS Fallback
        if (!downloadUrl && gifted && typeof gifted.giftedig === 'function') {
            try {
                const gRes = await gifted.giftedig(cleanUrl);
                if (gRes?.result && gRes.result.length > 0) {
                    downloadUrl = gRes.result[0]?.url || gRes.result[0];
                }
            } catch (e) {}
        }

        if (!downloadUrl || typeof downloadUrl !== 'string' || !downloadUrl.startsWith('http')) {
            sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
            return await sock.sendMessage(targetChat, { 
                text: `❌ *Instagram මාධ්‍යය ලබාගත නොහැක. Post එක Public එකක් දැයි පරීක්ෂා කරන්න!*${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }

        const caption = `*📸 𝗜𝗡𝗦𝗧𝗔𝗚𝗥𝗔𝗠 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗 📸*${DEFAULT_FOOTER}`;

        try {
            // URL Stream එකෙන් කෙලින්ම Dispatch කිරීම (RAM එක Safe වෙනවා)
            await sock.sendMessage(targetChat, {
                video: { url: downloadUrl },
                caption: caption,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

        } catch (sendErr) {
            // Stream එක Block වුවහොත් Buffer එකක් විදියට යැවීම
            try {
                const vidBuffer = await axios.get(downloadUrl, { 
                    responseType: 'arraybuffer', 
                    timeout: 25000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                await sock.sendMessage(targetChat, {
                    video: Buffer.from(vidBuffer.data),
                    caption: caption,
                    mimetype: 'video/mp4'
                }, { quoted: msg });

                sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});
            } catch (finalErr) {
                sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
                await sock.sendMessage(targetChat, { 
                    text: `❌ *වීඩියෝව එවීමේදී දෝෂයක් මතු විය.*${DEFAULT_FOOTER}` 
                }, { quoted: msg });
            }
        }
    }
};

