// commands/restart.js
module.exports = {
    name: 'restart',
    category: 'owner',
    desc: 'Clean RAM cache and reboot the bot process',

    async execute(sock, msg, args, chatJid) {
        const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
            ? chatJid 
            : msg.key.remoteJid;

        // Reaction
        await sock.sendMessage(targetChat, { react: { text: "🔄", key: msg.key } }).catch(() => {});

        const beforeMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        // 1. Memory cache cleanup
        try {
            if (global.gc) {
                global.gc(); // Node garbage collector (if enabled)
            }
            // Clear require cache for non-node_modules
            Object.keys(require.cache).forEach((key) => {
                if (!key.includes('node_modules')) {
                    delete require.cache[key];
                }
            });
        } catch (e) {
            console.error("Cache clean error:", e);
        }

        const afterMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        const restartCard = `╭━━〔 ⚡ 𝐇𝐄𝐒𝐇𝐀𝐍-𝐌𝐃 ⚡ 〕━━╮
┃ 
┃ ✦ ᴀᴄᴛɪᴏɴ  : System Reboot 🔄
┃ ✦ ʀᴀᴍ ʙᴇғ : ${beforeMem} MB
┃ ✦ ʀᴀᴍ ᴀғᴛ : ${afterMem} MB
┃ ✦ sᴛᴀᴛᴜs  : Restarting...
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
> 🔐 *heshan ofc • restarting engine...*`;

        await sock.sendMessage(targetChat, { text: restartCard }, { quoted: msg });

        // තත්පර 1.5 කින් process එක clean exit වී PM2 / Docker / Render හරහා auto-restart වේ
        setTimeout(() => {
            process.exit(0);
        }, 1500);
    }
};
