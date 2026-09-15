const os = require('os');

function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

module.exports = {
    name: 'alive',
    category: 'general',
    desc: 'Check bot operational status and info',
    async execute(sock, msg, args, chatJid) {
        const targetChat = chatJid || msg.key.remoteJid;
        const pushname = msg.pushName || 'User';

        try {
            // 1. Initial reaction
            try {
                await sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } });
            } catch (e) {}

            const start = Date.now();
            const uptime = formatUptime(process.uptime());
            const usedRam = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
            const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
            const latency = Date.now() - start;

            const aliveMsg = `╭───❮ *HESHAN-MD CORE* ❯───╮
│
├◈ 👤 *User:* ${pushname}
├◈ 🟢 *Status:* Online
├◈ ⏱️ *Uptime:* ${uptime}
├◈ ⚡ *Speed:* ${latency}ms
├◈ 🧠 *RAM:* ${usedRam}MB / ${totalRam}GB
├◈ 👑 *Owner:* Dinidu Heshan
│
╰──────────────────────────╯

╭───❮ *QUICK ACTIONS* ❯───╮
│
├◈ \`.menu\` — All Commands
├◈ \`.ping\` — Speed Test
├◈ \`.song\` — Audio Downloader
│
╰──────────────────────────╯
> 🔐 *heshan ofc • all rights reserved*`;

            const imgUrl = 'https://files.catbox.moe/a58add.jpeg';

            // 2. Direct URL send (Buffer delay නැති නිසා ක්ෂණිකව send වේ)
            try {
                await sock.sendMessage(targetChat, { 
                    image: { url: imgUrl }, 
                    caption: aliveMsg 
                }, { quoted: msg });
            } catch (imgErr) {
                await sock.sendMessage(targetChat, { text: aliveMsg }, { quoted: msg });
            }

        } catch (err) {
            console.error('Alive Error:', err.message);
        }
    }
};
