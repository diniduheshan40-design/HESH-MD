const os = require('os');
const axios = require('axios');
const { cmd } = require('../command'); // bot framework එක අනුව path එක

function formatUptime(seconds) {
    seconds = Number(seconds);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

// Backend එකෙන් Active Bots ගාන ගන්න helper function එක
async function getActiveBots() {
    try {
        // ඔයාගෙ backend API URL එක මෙතනට දාන්න (උදා: https://my-bot-api.render.com/active-bots)
        const res = await axios.get('https://YOUR_BACKEND_API_URL/active-bots', { timeout: 3000 });
        return res.data.count || res.data.active || '1';
    } catch (e) {
        return '1'; // API timeout හෝ error ආවොත් fallback අගය
    }
}

cmd({
    pattern: "alive",
    desc: "Check bot online status",
    category: "main",
    filename: __filename
},
async(conn, mek, m, { from, pushname, reply }) => {
    try {
        // 1. Command එකට ⚡ react කරනවා
        await conn.sendMessage(from, { 
            react: { 
                text: "⚡", 
                key: mek.key 
            } 
        });

        const start = Date.now();
        const uptime = formatUptime(process.uptime());
        const usedRam = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
        const speed = (Date.now() - start).toFixed(3);

        // Active bots count එක fetch කරගන්නවා
        const activeBots = await getActiveBots();

        const aliveMsg = `╭───❮ ❖ 𝗛 𝗘 𝗦 𝗛 𝗔 𝗡 - 𝗠 𝗗 ❖ ❯───╮
│  ꜱ ɪ ᴍ ᴘ ʟ ᴇ  •  ꜰ ᴀ ꜱ ᴛ  •  ᴘ ᴏ ᴡ ᴇ ʀ ꜰ ᴜ ʟ
│
│  👋 *Greetings,* ${pushname || 'User'}!
│  📡 *Core Status:* [ 🟢 𝗢𝗡𝗟𝗜𝗡𝗘 ]
│
│ ╭───❮ 📊 𝗦𝗬𝗦𝗧𝗘𝗠 𝗠𝗘𝗧𝗥𝗜𝗖𝗦 ❯───
│ ├─◈ ⏱️ *Uptime*      : ${uptime}
│ ├─◈ ⚡ *Latency*     : ${speed} ms
│ ├─◈ 🧠 *RAM Load*    : ${usedRam}MB / ${totalRam}GB
│ ├─◈ 🗄️ *Platform*    : Linux (Render)
│ ╰─────────────────────────────
│
│ ╭───❮ 🤖 𝗕𝗢𝗧 𝗢𝗩𝗘𝗥𝗩𝗜𝗘𝗪 ❯─────
│ ├─◈ 👑 *Dev*         : Dinidu Heshan
│ ├─◈ 🏷️ *Version*     : v1.0.0
│ ├─◈ 🛡️ *Prefix*      : [ . ]
│ ├─◈ 🌐 *Active Bots* : ${activeBots} Active
│ ├─◈ 🔒 *Mode*        : Public
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

        await conn.sendMessage(from, {
            image: { url: 'https://files.catbox.moe/a58add.jpeg' },
            caption: aliveMsg
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply(`Error: ${e.message}`);
    }
});
