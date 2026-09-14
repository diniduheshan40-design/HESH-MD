const { Auth } = require('../auth');

module.exports = {
    name: 'alive',
    async execute(sock, msg, args, targetChat) {
        const chatJid = targetChat || msg.key.remoteJid;

        // Uptime ගණනය කිරීම
        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);
        const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

        // RAM Usage
        const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        // Database එකෙන් Active Sessions (Bots) ගණන ලබා ගැනීම
        let activeBotsCount = 1;
        try {
            const sessions = await Auth.countDocuments({ _id: /-creds$/ });
            if (sessions && sessions > 0) {
                activeBotsCount = sessions;
            }
        } catch (e) {
            activeBotsCount = 1;
        }

        // WhatsApp වල කැඩෙන්නේ නැති පිරිසිදු Aesthetic UI Layout එක
        const captionText = `*⚡ HESHAN-MD SYSTEM STATUS ⚡*
────────────────────────────
*🤖 Bot Name :* HESHAN-MD
*🟢 Status   :* Online Operational
*👥 Active   :* ${activeBotsCount} Instances Active
*⏱️ Uptime   :* ${uptimeStr}
*📊 Memory   :* ${ramUsage} MB
*⚙️ Mode     :* Public
*👨‍💻 Owner    :* Dinidu Heshan
*📌 Prefix   :* [ . ]
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

        const imageUrl = 'https://files.catbox.moe/a58add.jpeg'; 

        try {
            await sock.sendMessage(chatJid, {
                image: { url: imageUrl },
                caption: captionText
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(chatJid, { text: captionText }, { quoted: msg });
        }
    }
};
