// commands/setchannel.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

const CONFIG_PATH = path.join(process.cwd(), 'temp', 'tiktok_channel_config.json');
const API_KEY = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';

// කලින් යැවූ වීඩියෝ නැවත නොයැවීමට memory cache එකක්
const postedVideoUrls = new Set();
global.tiktokChannelInterval = global.tiktokChannelInterval || null;

function getConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
    } catch (e) {}
    return { channelJid: null, query: 'mrbeast' };
}

function saveConfig(data) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Config Save Error:', e.message);
    }
}

// 🟢 Chamindu API එකෙන් Random TikTok Video Buffer එකක් ලබා ගැනීම
async function fetchTikTokVideo(query = 'mrbeast') {
    try {
        const searchUrl = `https://api.chamindu.site/api/v1/tiktok?q=${encodeURIComponent(query)}&api_key=${API_KEY}`;
        const searchRes = await axios.get(searchUrl, { timeout: 15000 });

        const results = searchRes.data?.data?.results || searchRes.data?.results || [];
        // වීඩියෝ පමණක් සහ කලින් නොයැවූ ඒවා පෙරීම
        let videoItems = results.filter(item => item.is_video && item.dl && !postedVideoUrls.has(item.url));

        // සියල්ල යවා ඇත්නම් Cache එක reset කිරීම
        if (videoItems.length === 0) {
            postedVideoUrls.clear();
            videoItems = results.filter(item => item.is_video && item.dl);
        }

        if (videoItems.length === 0) return null;

        // Random Video එකක් තෝරා ගැනීම
        const selected = videoItems[Math.floor(Math.random() * videoItems.length)];
        postedVideoUrls.add(selected.url);

        // Download API එකෙන් වීඩියෝ Binary Buffer එක ලබා ගැනීම
        const dlResponse = await axios.get(selected.dl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        return {
            buffer: Buffer.from(dlResponse.data),
            title: selected.title || 'Trending TikTok Video',
            author: selected.author || '@tiktok'
        };
    } catch (err) {
        console.error('❌ [TIKTOK-API-ERROR]:', err.message);
        return null;
    }
}

// 🟢 Channel එකට Video එක RelayMessage මඟින් Post කිරීම
async function postTikTokToChannel(sock, channelJid, query = 'mrbeast') {
    try {
        const videoData = await fetchTikTokVideo(query);
        if (!videoData || !videoData.buffer) {
            console.log('⚠️ [TIKTOK-POST] Video data could not be retrieved.');
            return false;
        }

        const caption = `┏━━━〔 🎬 𝗧𝗜𝗞𝗧𝗢𝗞 𝗩𝗜𝗗𝗘𝗢 〕━━━┓\n` +
                        `┃\n` +
                        `┃  📌 *Title* ⌁ ${videoData.title}\n` +
                        `┃  👤 *Author* ⌁ ${videoData.author}\n` +
                        `┃  ⏰ *Auto Post* ⌁ Every 5 Mins\n` +
                        `┃\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                        `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

        // 1. WhatsApp Video Media Object එක සෑදීම
        const media = await generateWAMessageContent({
            video: videoData.buffer,
            caption: caption,
            mimetype: 'video/mp4'
        }, { upload: sock.waUploadToServer });

        // 2. Channel Newsletter Container එකට VideoMessage එක දැමීම
        const fullMsg = generateWAMessageFromContent(channelJid, {
            videoMessage: media.videoMessage
        }, {});

        // 3. RelayMessage මඟින් Channel එකට යැවීම
        await sock.relayMessage(channelJid, fullMsg.message, {
            messageId: fullMsg.key.id
        });

        console.log(`✅ [AUTO-TIKTOK] Successfully posted video to ${channelJid} at ${new Date().toLocaleTimeString()}`);
        return true;
    } catch (err) {
        console.error('❌ [TIKTOK-POST-ERROR]:', err.message);
        return false;
    }
}

// 🟢 විනාඩි 5න් 5ට ක්‍රියාත්මක වන ස්ථිර Background Loop එක
function startTikTokScheduler(sock, channelJid, query) {
    if (global.tiktokChannelInterval) {
        clearInterval(global.tiktokChannelInterval);
        global.tiktokChannelInterval = null;
    }

    console.log(`🚀 [AUTO-TIKTOK] Background loop started for ${channelJid} (Every 5 mins)`);

    global.tiktokChannelInterval = setInterval(async () => {
        const cfg = getConfig();
        const target = cfg.channelJid || channelJid;
        if (!target) return;

        let activeSock = sock;
        if (global.activeSessions) {
            const keys = Object.keys(global.activeSessions);
            if (keys.length > 0) activeSock = global.activeSessions[keys[0]];
        }

        if (activeSock && activeSock.relayMessage) {
            await postTikTokToChannel(activeSock, target, cfg.query || query);
        }
    }, 5 * 60 * 1000);
}

module.exports = {
    name: 'setchannel',
    alias: ['settiktok', 'autotiktok'],
    category: 'admin',
    desc: 'Set WhatsApp channel to post TikTok videos every 5 minutes',

    async execute(sock, msg, args, chatJid) {
        const targetChat = chatJid || msg.key.remoteJid;
        const input = args[0] ? args[0].trim() : '';
        const searchKeyword = args.slice(1).join(' ') || 'mrbeast';

        // 1. Auto Post නැවැත්වීම
        if (input.toLowerCase() === 'stop' || input.toLowerCase() === 'off') {
            if (global.tiktokChannelInterval) {
                clearInterval(global.tiktokChannelInterval);
                global.tiktokChannelInterval = null;
            }
            saveConfig({ channelJid: null });
            return await sock.sendMessage(targetChat, { 
                text: '🛑 *Auto TikTok Posting සේවාව නවත්වන ලදී.*' 
            }, { quoted: msg });
        }

        let resolvedJid = null;

        // 2. Channel Link හෝ Direct JID හඳුනා ගැනීම
        if (input.includes('whatsapp.com/channel/')) {
            try {
                const inviteCode = input.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0].trim();
                if (typeof sock.newsletterMetadata === 'function') {
                    const meta = await sock.newsletterMetadata('invite', inviteCode);
                    if (meta?.id) resolvedJid = meta.id;
                }
            } catch (e) {}
        } else if (input.includes('@newsletter')) {
            resolvedJid = input;
        }

        if (!resolvedJid) {
            const cfg = getConfig();
            return await sock.sendMessage(targetChat, {
                text: `⚠️ *කරුණාකර වලංගු Channel Link එකක් හෝ JID එකක් ලබා දෙන්න!*\n\n` +
                      `📌 *භාවිතය:*\n` +
                      `• .setchannel 120363420419246945@newsletter\n` +
                      `• .setchannel 120363420419246945@newsletter funny cats\n` +
                      `• .setchannel stop\n\n` +
                      `⚙️ *වත්මන් Channel:* ${cfg.channelJid || 'සකසා නැත'}`
            }, { quoted: msg });
        }

        await sock.sendMessage(targetChat, { 
            text: `⏳ *පළමු TikTok වීඩියෝව Channel එකට යවමින් සේවාව සක්‍රිය කෙරේ... (කරුණාකර මොහොතක් රැඳී සිටින්න)*` 
        }, { quoted: msg });

        // 3. පළමු වීඩියෝව යවා බැලීම
        const success = await postTikTokToChannel(sock, resolvedJid, searchKeyword);

        if (success) {
            saveConfig({ channelJid: resolvedJid, query: searchKeyword });
            startTikTokScheduler(sock, resolvedJid, searchKeyword);

            await sock.sendMessage(targetChat, {
                text: `✅ *Auto TikTok Posting සාර්ථකව සක්‍රිය විය!*\n\n` +
                      `📢 *Channel JID:* ${resolvedJid}\n` +
                      `🔍 *Query:* ${searchKeyword}\n` +
                      `⏱️ *කාල පරතරය:* සෑම විනාඩි 5කට වරක්\n\n` +
                      `> ⚡ පළමු වීඩියෝව Channel එකට Post විය. මෙතැන් සිට ස්වයංක්‍රීයව වීඩියෝ වැටෙනු ඇත.`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(targetChat, {
                text: `❌ *වීඩියෝව Channel එකට Post කිරීමට නොහැකි විය.*\n\n` +
                      `📌 කරුණාකර Bot අංකය Channel එකේ Admin කෙනෙක් දැයි නැවත තහවුරු කරගන්න.`
            }, { quoted: msg });
        }
    }
};

