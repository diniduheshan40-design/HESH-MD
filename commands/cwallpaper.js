// commands/setchannel.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { generateWAMessageContent, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

const CONFIG_PATH = path.join(process.cwd(), 'temp', 'channel_config.json');

// 🟢 විශ්වාසදායක 4K Wallpaper Images (API down වුවහොත් භාවිතයට)
const WALLPAPER_COLLECTION = [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=80',
    'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?w=1920&q=80',
    'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1920&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&q=80',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80'
];

let autoPostTimer = null;

function getSavedConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        }
    } catch (e) {}
    return { channelJid: null, channelName: null };
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

// 🟢 4K Wallpaper එකක් Buffer එකක් ලෙස ලබාගැනීම
async function fetchWallpaperBuffer() {
    let imgUrl = null;
    try {
        const res = await axios.get('https://supunofc.site/api/image/4kwallpapers/home?apikey=supun-tvo5olfxylo98b8l6b9lq174', { timeout: 8000 });
        if (res.data?.result && Array.isArray(res.data.result) && res.data.result.length > 0) {
            const item = res.data.result[Math.floor(Math.random() * res.data.result.length)];
            imgUrl = typeof item === 'string' ? item : (item.image || item.url || item.download);
        }
    } catch (e) {}

    if (!imgUrl) {
        imgUrl = WALLPAPER_COLLECTION[Math.floor(Math.random() * WALLPAPER_COLLECTION.length)];
    }

    const response = await axios.get(imgUrl, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    return Buffer.from(response.data);
}

// 🟢 Newsletter එකට නිවැරදි Baileys Protocol එකෙන් Media යැවීම
async function postWallpaperToNewsletter(sock, channelJid) {
    try {
        const imgBuffer = await fetchWallpaperBuffer();

        const caption = `┏━━━〔 🖼️ 𝟰𝗞 𝗪𝗔𝗟𝗟𝗣𝗔𝗣𝗘𝗥 〕━━━┓\n` +
                        `┃\n` +
                        `┃  ✨ *Quality* ⌁ Ultra HD 4K\n` +
                        `┃  ⏰ *Auto Post* ⌁ Every 5 Mins\n` +
                        `┃\n` +
                        `┗━━━━━━━━━━━━━━━━━━━━━━┛\n` +
                        `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

        // 1. WhatsApp Media Upload
        const media = await generateWAMessageContent({
            image: imgBuffer,
            caption: caption
        }, { upload: sock.waUploadToServer });

        // 2. Newsletter Message Object එක සෑදීම
        const message = generateWAMessageFromContent(channelJid, {
            imageMessage: media.imageMessage
        }, {});

        // 3. RelayMessage මඟින් Newsletter එකට Push කිරීම
        await sock.relayMessage(channelJid, message.message, {
            messageId: message.key.id
        });

        console.log(`✅ [WALLPAPER] Sent to ${channelJid} successfully.`);
        return { success: true };
    } catch (err) {
        console.error('❌ [WALLPAPER-RELAY-ERROR]:', err);
        return { success: false, error: err.message };
    }
}

// 🟢 Auto Poster Loop
function setupAutoPostLoop(sock) {
    if (autoPostTimer) clearInterval(autoPostTimer);

    autoPostTimer = setInterval(async () => {
        const config = getSavedConfig();
        if (config && config.channelJid) {
            console.log(`⏳ [AUTO-WALLPAPER] Posting to ${config.channelJid}...`);
            await postWallpaperToNewsletter(sock, config.channelJid);
        }
    }, 5 * 60 * 1000);
}

module.exports = {
    name: 'setchannel',
    alias: ['autowallpaper', 'wallchannel'],
    category: 'owner',
    desc: 'Set channel link or JID to post 4K wallpaper every 5 minutes',

    async execute(sock, msg, args, chatJid) {
        const targetChat = chatJid || msg.key.remoteJid;
        const input = args[0] ? args[0].trim() : '';

        // 1. Off / Stop කිරීම
        if (input.toLowerCase() === 'stop' || input.toLowerCase() === 'off') {
            if (autoPostTimer) {
                clearInterval(autoPostTimer);
                autoPostTimer = null;
            }
            saveConfig({ channelJid: null, channelName: null });
            return await sock.sendMessage(targetChat, { 
                text: '🛑 *Auto Wallpaper Posting සේවාව නවත්වන ලදී.*' 
            }, { quoted: msg });
        }

        if (!input) {
            const config = getSavedConfig();
            return await sock.sendMessage(targetChat, {
                text: `⚠️ *කරුණාකර Channel Link එකක් හෝ JID එකක් ලබා දෙන්න!*\n\n` +
                      `📌 *භාවිතය:*\n` +
                      `• .setchannel https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V\n` +
                      `• .setchannel 120363420419246945@newsletter\n` +
                      `• .setchannel stop\n\n` +
                      `⚙️ *වත්මන් Channel:* ${config.channelName ? `${config.channelName} (${config.channelJid})` : (config.channelJid || 'සකසා නැත')}`
            }, { quoted: msg });
        }

        let resolvedJid = null;
        let channelTitle = 'WhatsApp Channel';

        await sock.sendMessage(targetChat, { text: '⏳ *Channel විස්තර ලබා ගනිමින් පවතී...*' }, { quoted: msg });

        // 2. Link එකක් දුනහොත් Invite Code එකෙන් Metadata ලබාගැනීම
        if (input.includes('whatsapp.com/channel/')) {
            try {
                const inviteCode = input.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0].trim();
                
                if (typeof sock.newsletterMetadata === 'function') {
                    const meta = await sock.newsletterMetadata('invite', inviteCode);
                    if (meta?.id) {
                        resolvedJid = meta.id;
                        channelTitle = meta.name || channelTitle;
                    }
                }
            } catch (linkErr) {
                return await sock.sendMessage(targetChat, {
                    text: `❌ *Channel Link එකෙන් තොරතුරු ලබාගත නොහැකි විය.* Link එක නිවැරදි දැයි බලන්න හෝ කෙලින්ම JID එක ලබා දෙන්න.`
                }, { quoted: msg });
            }
        } else if (input.includes('@newsletter')) {
            resolvedJid = input;
        }

        if (!resolvedJid) {
            return await sock.sendMessage(targetChat, {
                text: '❌ *වලංගු Channel JID එකක් හමු නොවීය.*'
            }, { quoted: msg });
        }

        // 3. Test Post එකක් යැවීම
        await sock.sendMessage(targetChat, { 
            text: `⏳ *${channelTitle} වෙත පළමු Wallpaper එක යවමින් පරීක්ෂා කෙරේ...*` 
        }, { quoted: msg });

        const result = await postWallpaperToNewsletter(sock, resolvedJid);

        if (result.success) {
            saveConfig({ channelJid: resolvedJid, channelName: channelTitle });
            setupAutoPostLoop(sock);

            await sock.sendMessage(targetChat, {
                text: `✅ *Auto Wallpaper සාර්ථකව සක්‍රිය විය!*\n\n` +
                      `📢 *Channel:* ${channelTitle}\n` +
                      `🆔 *JID:* ${resolvedJid}\n` +
                      `⏱️ *කාල පරතරය:* සෑම විනාඩි 5කට වරක්\n\n` +
                      `> ⚡ පළමු Wallpaper එක දැන් Channel එකට සාර්ථකව Post විය!`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(targetChat, {
                text: `❌ *Channel එකට Post කිරීමට නොහැකි විය!*\n\n` +
                      `⚠️ *Error Code:* ${result.error}\n\n` +
                      `📌 *විසඳුම:* මෙම බොට් සම්බන්ධ කර ඇති WhatsApp අංකය අදාළ Channel එකේ *Admin* කෙනෙක් ලෙස පත් කර තිබිය යුතුය.`
            }, { quoted: msg });
        }
    }
};

