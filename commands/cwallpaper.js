// commands/setchannel.js
const fs = require('fs');
const path = require('path');
const { sendTikTokVideoToChannel } = require('../lib/channelPoster');

const CONFIG_PATH = path.join(process.cwd(), 'temp', 'tiktok_channel_config.json');

// Global timer එකක් තබා ගැනීම (Multiple executions නොවීමට)
global.tiktokPosterInterval = global.tiktokPosterInterval || null;

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
    } catch (e) {}
}

function startPostingLoop(sock, channelJid, query) {
    if (global.tiktokPosterInterval) {
        clearInterval(global.tiktokPosterInterval);
        global.tiktokPosterInterval = null;
    }

    console.log(`🚀 [TIKTOK-SCHEDULER] Started for ${channelJid} (Every 5 mins)`);

    global.tiktokPosterInterval = setInterval(async () => {
        const cfg = getConfig();
        const targetJid = cfg.channelJid || channelJid;
        if (!targetJid) return;

        // Active Session එකක් සොයා ගැනීම
        let activeSock = sock;
        if (global.activeSessions) {
            const keys = Object.keys(global.activeSessions);
            if (keys.length > 0) activeSock = global.activeSessions[keys[0]];
        }

        if (activeSock) {
            await sendTikTokVideoToChannel(activeSock, targetJid, cfg.query || query);
        }
    }, 5 * 60 * 1000);
}

module.exports = {
    name: 'setchannel',
    alias: ['settiktok', 'tiktokchannel'],
    category: 'admin',
    desc: 'Auto post TikTok videos to newsletter every 5 minutes',

    async execute(sock, msg, args, chatJid) {
        const targetChat = chatJid || msg.key.remoteJid;
        const input = args[0] ? args[0].trim() : '';
        const searchKeyword = args.slice(1).join(' ') || 'mrbeast';

        // 1. Stop Command
        if (input.toLowerCase() === 'stop' || input.toLowerCase() === 'off') {
            if (global.tiktokPosterInterval) {
                clearInterval(global.tiktokPosterInterval);
                global.tiktokPosterInterval = null;
            }
            saveConfig({ channelJid: null });
            return await sock.sendMessage(targetChat, { text: '🛑 *Auto TikTok Posting සේවාව නවත්වන ලදී.*' }, { quoted: msg });
        }

        let resolvedJid = null;

        // 2. Resolve Link or JID
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
                text: `⚠️ *කරුණාකර වලංගු Channel JID එකක් හෝ Link එකක් ලබා දෙන්න!*\n\n` +
                      `📌 *භාවිතය:*\n` +
                      `• .setchannel 120363420419246945@newsletter\n` +
                      `• .setchannel 120363420419246945@newsletter funny cats\n` +
                      `• .setchannel stop\n\n` +
                      `⚙️ *වත්මන් Channel:* ${cfg.channelJid || 'නැත'}`
            }, { quoted: msg });
        }

        await sock.sendMessage(targetChat, { 
            text: `⏳ *TikTok වීඩියෝව ලබාගෙන Channel එකට යවමින් පවතී... (කරුණාකර තත්පර කිහිපයක් රැඳී සිටින්න)*` 
        }, { quoted: msg });

        // 3. Test Run එකක් යැවීම
        const result = await sendTikTokVideoToChannel(sock, resolvedJid, searchKeyword);

        if (result.success) {
            saveConfig({ channelJid: resolvedJid, query: searchKeyword });
            startPostingLoop(sock, resolvedJid, searchKeyword);

            await sock.sendMessage(targetChat, {
                text: `✅ *Auto TikTok Posting සාර්ථකව සක්‍රිය විය!*\n\n` +
                      `📢 *Channel JID:* ${resolvedJid}\n` +
                      `🔍 *Query:* ${searchKeyword}\n` +
                      `⏱️ *කාල පරතරය:* සෑම විනාඩි 5කට වරක්\n\n` +
                      `> ⚡ පළමු වීඩියෝව Channel එකට Post විය!`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(targetChat, {
                text: `❌ *වීඩියෝව Channel එකට Post කිරීමට නොහැකි විය!*\n\n*හේතුව:* ${result.error}\n\n📌 කරුණාකර Bot අංකය Channel එකේ Admin කෙනෙක් දැයි නැවත බලන්න.`
            }, { quoted: msg });
        }
    }
};

