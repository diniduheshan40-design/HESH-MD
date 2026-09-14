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
    async execute(sock, msg, args, chatJid, safeReply) {
        const targetChat = chatJid || msg.key.remoteJid;
        const pushname = msg.pushName || 'User';

        try {
            // 1. Command එක ආපු ගමන් ⚡ React කිරීම
            await sock.sendMessage(targetChat, { 
                react: { 
                    text: "⚡", 
                    key: msg.key 
                } 
            });

            const start = Date.now();
            const uptime = formatUptime(process.uptime());
            const usedRam = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
            const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
            const latency = Date.now() - start;

            const aliveMsg = `╭───❮ ❖ 𝗛 𝗘 𝗦 𝗛 𝗔 𝗡 - 𝗠 𝗗 ❖ ❯───╮
│  ꜱ ɪ ᴍ ᴘ ʟ ᴇ  •  ꜰ ᴀ ꜱ ᴛ  •  ᴘ ᴏ ᴡ ᴇ ʀ ꜰ ᴜ ʟ
│
│  👋 *Greetings,* ${pushname}!
│  📡 *Core Status:* [ 🟢 𝗢𝗡𝗟𝗜𝗡𝗘 ]
│
│ ╭───❮ 📊 𝗦𝗬𝗦𝗧𝗘𝗠 𝗠𝗘𝗧𝗥𝗜𝗖𝗦 ❯───
│ ├─◈ ⏱️ *Uptime*   : ${uptime}
│ ├─◈ ⚡ *Latency*  : ${latency} ms
│ ├─◈ 🧠 *RAM Load* : ${usedRam}MB / ${totalRam}GB
│ ├─◈ 🗄️ *Platform* : Linux (Render)
│ ╰─────────────────────────────
│
│ ╭───❮ 🤖 𝗕𝗢𝗧 𝗢𝗩𝗘𝗥𝗩𝗜𝗘𝗪 ❯─────
│ ├─◈ 👑 *Dev*      : Dinidu Heshan
│ ├─◈ 🏷️ *Version*  : v1.0.0
│ ├─◈ 🛡️ *Prefix*   : [ . ]
│ ├─◈ 🌐 *Mode*     : Public
│ ╰─────────────────────────────
│
│ ╭───❮ ⚡ 𝗤𝗨𝗜𝗖𝗞 𝗔𝗖𝗧𝗜𝗢𝗡𝗦 ❯────
│ │  ▸ *.menu*  — View Command Center
│ │  ▸ *.ping*  — Test Connection Speed
│ │  ▸ *.owner* — Contact Developer
│ ╰─────────────────────────────
│
│  > 🔐 ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ
╰───────────────────────────────╯`;

            // Image එක Buffer එකක් විදිහට load කර යැවීම (Failures වළක්වයි)
            try {
                const imgRes = await fetch('https://files.catbox.moe/a58add.jpeg');
                const imgBuffer = await imgRes.buffer();

                await sock.sendMessage(targetChat, {
                    image: imgBuffer,
                    caption: aliveMsg
                }, { quoted: msg });

            } catch (imgErr) {
                // Image එක fail වුවහොත් ක්ෂණිකව Text එක පමණක් යවයි
                await sock.sendMessage(targetChat, { text: aliveMsg }, { quoted: msg });
            }

        } catch (err) {
            console.error('Alive Command Error:', err);
            // Fatal Error එකකදී chat එකට log එක යැවීම
            await sock.sendMessage(targetChat, { text: `❌ Alive Error: ${err.message}` }, { quoted: msg });
        }
    }
};
