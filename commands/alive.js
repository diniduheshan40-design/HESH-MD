module.exports = {
    name: 'alive',
    async execute(sock, msg, args, sender) {
        // Uptime ගණනය කිරීම
        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);
        const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

        // RAM usage එක
        const ramUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        const captionText = `
╭───〔 ⚡ *HESH-MD V2* ⚡ 〕───╮
│
├▸ *Status:* Online 🟢
├▸ *Uptime:* ${uptimeStr}
├▸ *RAM Usage:* ${ramUsage} MB
├▸ *Mode:* Public
├▸ *Version:* 2.0.0
│
├▸ *Owner:* Dinidu Heshan
├▸ *Prefix:* [ . ]
│
╰─────────────────────╯

> *Powered by HESH-MD Engine* 🚀
`.trim();

        // ඔයා කැමති image එකක direct link එකක් මෙතනට දෙන්න
        const imageUrl = 'https://files.catbox.moe/a58add.jpeg'; 

        await sock.sendMessage(sender, {
            image: { url: imageUrl },
            caption: captionText
        }, { quoted: msg });
    }
};
