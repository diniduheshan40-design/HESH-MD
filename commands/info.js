// commands/info.js
const os = require('os');
const process = require('process');

function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

module.exports = {
    name: 'info',
    alias: ['system', 'botinfo'],
    category: 'general',
    desc: 'Display system specs, uptime and bot status',

    async execute(sock, msg, args, chatJid) {
        const start = Date.now();
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        // Non-blocking instant reaction
        sock.sendMessage(targetChat, { react: { text: "📊", key: msg.key } }).catch(() => {});

        // ⚡ Accurate Process RAM usage (Safe on Render / Docker VPS)
        const memoryUsage = process.memoryUsage();
        const processUsedMem = (memoryUsage.rss / (1024 * 1024)).toFixed(1);
        const totalMem = (os.totalmem() / (1024 * 1024)).toFixed(0);
        
        const platform = os.platform() === 'linux' ? 'Linux (Cloud VPS)' : os.platform();
        const uptime = formatUptime(process.uptime());

        // User profile name
        const pushName = msg.pushName || "User";
        let firstName = pushName.split(/[\s_+-]+/)[0] || "User";
        if (firstName.length > 15) firstName = firstName.substring(0, 15);

        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const currentPrefix = (rawText && /^[.#/!]/.test(rawText.charAt(0))) ? rawText.charAt(0) : '.';

        // ⚡ Dynamic Sub-Bots Count from global.activeSessions
        const sessions = global.activeSessions || {};
        const activeBotsCount = Math.max(Object.keys(sessions).length, 1);

        // Real Execution Latency (ms)
        const latency = Date.now() - start;

        const infoCard = `╭━━〔 ⚡ 𝐇𝐄𝐒𝐇𝐀𝐍-𝐌𝐃 ⚡ 〕━━╮
┃ 
┃ ✦ ᴜsᴇʀ    : ${firstName}
┃ ✦ ᴘʀᴇғɪx  : ${currentPrefix}
┃ ✦ ʀᴜɴᴛɪᴍᴇ : ${uptime}
┃ ✦ sᴛᴀᴛᴜs  : Online 🟢
┃ ✦ ᴍᴏᴅᴇ    : Public
┃ ✦ ʙᴏᴛs    : ${activeBotsCount} Active
┃
┣━━〔 📊 𝐒𝐘𝐒𝐓𝐄𝐌 𝐈𝐍𝐅𝐎 〕━━┫
┃
┃ ✦ ʀᴀᴍ     : ${processUsedMem}MB / ${totalMem}MB
┃ ✦ sᴘᴇᴇᴅ   : ${latency} ms
┃ ✦ ᴘʟᴀᴛғᴏʀᴍ: ${platform}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
> 🔐 *heshan ofc • all rights reserved*`;

        try {
            await sock.sendMessage(targetChat, { text: infoCard }, { quoted: msg });
            sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error("Info Command Error:", err?.message || err);
        }
    }
};
