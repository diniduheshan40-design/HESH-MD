const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    name: 'hack',
    async execute(sock, msg, args, targetChat) {
        const chatJid = targetChat || msg.key.remoteJid;

        try {
            // 1. Command එක ගහපු ගමන් User ගේ Message එකට 💀 React කරනවා
            try {
                await sock.sendMessage(chatJid, {
                    react: {
                        text: "💀",
                        key: msg.key
                    }
                });
            } catch (e) {}

            let sentMsg = await sock.sendMessage(chatJid, { 
                text: "💻 *[ INITIATING CYBER ATTACK ]*\n\n💉 Injecting Malware..." 
            }, { quoted: msg });

            if (!sentMsg?.key) return;

            const steps = [
                "💉 Injecting Malware...",
                "█ 10%",
                "█ █ 20%",
                "█ █ █ 30%",
                "█ █ █ █ 40%",
                "█ █ █ █ █ 50%",
                "█ █ █ █ █ █ 60%",
                "█ █ █ █ █ █ 70%",
                "█ █ █ █ █ █ █ 80%",
                "█ █ █ █ █ █ █ █ 90%",
                "█ █ █ █ █ █ █ █ █ 100%",
                "⚙️ System hijacking in process...\n🌐 Connecting to remote server...",
                "📡 Device successfully connected...\n📥 Receiving private data...",
                "📂 Data extraction 100% completed!\n🧹 Killing evidence & removing malwares...",
                "💀 *HACKING COMPLETED BY HESHAN-MD*",
                "📤 Sending log documents to C2 server...",
                "✅ Successfully sent data. Connection terminated!",
                "🔒 *ALL BACKLOGS CLEARED & TRACES REMOVED!*"
            ];

            for (let step of steps) {
                await delay(900);
                try {
                    await sock.sendMessage(chatJid, {
                        text: `\`\`\`${step}\`\`\``,
                        edit: sentMsg.key
                    });
                } catch (editErr) {
                    // Edit fail වුවහොත් loop එක break නොවී දිගටම කරගෙන යාමට
                }
            }

            // 2. Edit වී අවසන් වූ පසු අන්තිම Message එකට ☠️ React කරනවා
            try {
                await sock.sendMessage(chatJid, {
                    react: {
                        text: "☠️",
                        key: sentMsg.key
                    }
                });
            } catch (e) {}

        } catch (err) {
            console.error('Hack Command Error:', err);
        }
    }
};
