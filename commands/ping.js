module.exports = {
    name: 'ping',
    async execute(sock, msg, args, sender) {
        const start = Date.now();

        // මුලින්ම යන කෙටි මැසේජ් එක
        const sentMsg = await sock.sendMessage(sender, { 
            text: "*Testing... ⚡*" 
        }, { quoted: msg });

        const latency = Date.now() - start;

        // Message එක edit කරලා speed එක පමණක් පෙන්වීම
        await sock.sendMessage(sender, {
            text: `*speed ${latency}ms 📍*`,
            edit: sentMsg.key
        });
    }
};

