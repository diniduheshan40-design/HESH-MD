module.exports = {
    name: 'alive',
    async execute(sock, msg, args, targetChat) {
        // chatJid එක හරහා පණිවිඩය ආපු නියම චැට් එකටම reply යැවීම තහවුරු කරයි
        const chatJid = targetChat || msg.key.remoteJid;

        // Uptime ගණනය කිරීම
        const uptimeSeconds = process.uptime();
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);
        const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

        // RAM Usage එක
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

> *Powered by HESH-MD Engine* 🚀`.trim();

        const imageUrl = 'https://files.catbox.moe/a58add.jpeg'; 

        try {
            // පින්තූරය සමඟ alive පණිවිඩය යැවීම
            await sock.sendMessage(chatJid, {
                image: { url: imageUrl },
                caption: captionText
            }, { quoted: msg });
        } catch (err) {
            console.error('Alive image send failed, falling back to text:', err);
            // Image එක load වීමට අපොහොසත් වුවහොත් text එක පමණක් හෝ යවයි
            await sock.sendMessage(chatJid, { text: captionText }, { quoted: msg });
        }
    }
};
