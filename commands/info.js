// commands/info.js
const os = require('os');
const process = require('process');

function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

module.exports = {
    name: 'info',
    category: 'general',
    desc: 'Display system specs, uptime and bot status',

    async execute(sock, msg, args, chatJid) {
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        // Loading reaction
        await sock.sendMessage(targetChat, { react: { text: "📊", key: msg.key } }).catch(() => {});

        // Speed / Latency calculation
        const start = Date.now();

        // System details
        const totalMem = (os.totalmem() / (1024 * 1024)).toFixed(0);
        const freeMem = (os.freemem() / (1024 * 1024)).toFixed(0);
        const usedMem = (totalMem - freeMem).toFixed(0);
        const platform = os.platform() === 'linux' ? 'Linux (Ubuntu)' : os.platform();
        const uptime = formatUptime(process.uptime());

        // User info
        let pushName = msg.pushName || "Heshan";
        let firstName = pushName.split(/[\s_+-]+/)[0] || "Heshan";
        if (firstName.length > 15) firstName = firstName.substring(0, 15);

        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        const currentPrefix = (rawText && /^[.#/!]/.test(rawText.charAt(0))) ? rawText.charAt(0) : '.';

        // Active bots count
        // Multi-session හෝ nested instances නැතිනම් default 1 ලෙස පෙන්වයි
        const activeBotsCount = global.activeBots ? global.activeBots.length : 1;

        const latency = (Date.now() - start) / 1000;

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
┃ ✦ ʀᴀᴍ     : ${usedMem}MB / ${totalMem}MB
┃ ✦ sᴘᴇᴇᴅ   : ${latency} ms
┃ ✦ ᴘʟᴀᴛғᴏʀᴍ: ${platform}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
> 🔐 *heshan ofc • all rights reserved*`;

        try {
            await sock.sendMessage(targetChat, { text: infoCard }, { quoted: msg });
            await sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});
        } catch (err) {
            console.error("Info Command Error:", err);
            await sock.sendMessage(targetChat, { text: infoCard }, { quoted: msg }).catch(() => {});
        }
    }
};
