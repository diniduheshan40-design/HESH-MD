const os = require('os');
const fetch = require('node-fetch');

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

    async execute(sock, msg, args, chatJid, safeReply) {
        const targetChat = chatJid || msg.key.remoteJid;
        const pushname = msg.pushName || 'User';

        const logoUrl = 'https://files.catbox.moe/a58add.jpeg';

        try {
            // 1. Safe React
            try {
                await sock.sendMessage(targetChat, {
                    react: {
                        text: "⚡",
                        key: msg.key
                    }
                });
            } catch (e) {}

            // 2. System info
            const start = Date.now();

            const uptime = formatUptime(process.uptime());

            const usedRam = (
                process.memoryUsage().heapUsed /
                1024 /
                1024
            ).toFixed(1);

            const totalRam = (
                os.totalmem() /
                1024 /
                1024 /
                1024
            ).toFixed(1);

            const latency = Date.now() - start;

            // 3. Alive message
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

            // 4. Download image safely
            let imageBuffer = null;

            try {
                const response = await fetch(logoUrl);

                if (response.ok) {
                    imageBuffer = await response.buffer();
                }
            } catch (e) {
                console.error('Image Download Error:', e.message);
            }

            // 5. Send image
            if (imageBuffer) {
                try {
                    await sock.sendMessage(
                        targetChat,
                        {
                            image: imageBuffer,
                            caption: aliveMsg
                        },
                        {
                            quoted: msg
                        }
                    );

                    return;
                } catch (imgErr) {
                    console.error('Image Send Error:', imgErr.message);
                }
            }

            // 6. Direct URL fallback
            try {
                await sock.sendMessage(
                    targetChat,
                    {
                        image: {
                            url: logoUrl
                        },
                        caption: aliveMsg
                    },
                    {
                        quoted: msg
                    }
                );

                return;
            } catch (urlErr) {
                console.error('URL Image Error:', urlErr.message);
            }

            // 7. Final text fallback
            await sock.sendMessage(
                targetChat,
                {
                    text: aliveMsg
                },
                {
                    quoted: msg
                }
            );

        } catch (err) {
            console.error('Alive Error:', err.message);

            try {
                await safeReply(
                    targetChat,
                    '❌ Alive command error.'
                );
            } catch (e) {}
        }
    }
};
