module.exports = {
    name: 'ping',
    async execute(sock, msg, args, targetChat) {
        // පණිවිඩය ආපු නියම චැට් එකටම reply යැවීම තහවුරු කරයි
        const chatJid = targetChat || msg.key.remoteJid;
        const start = Date.now();

        try {
            // මුලින්ම යන කෙටි මැසේජ් එක
            const sentMsg = await sock.sendMessage(chatJid, { 
                text: "*Testing... ⚡*" 
            }, { quoted: msg });

            const latency = Date.now() - start;

            // Message එක edit කරලා speed එක පෙන්වීම
            try {
                await sock.sendMessage(chatJid, {
                    text: `*speed ${latency}ms 📍*`,
                    edit: sentMsg.key
                });
            } catch (editErr) {
                // Edit fail වුවහොත් අලුත් message එකක් ලෙස latency එක යවයි
                await sock.sendMessage(chatJid, {
                    text: `*speed ${latency}ms 📍*`
                }, { quoted: msg });
            }
        } catch (err) {
            console.error('Ping Command Error:', err);
        }
    }
};
