// commands/hack.js
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    name: 'hack',
    category: 'fun',
    desc: 'Prank cyber terminal hack animation',

    async execute(sock, msg, args, targetChat) {
        const chatJid = targetChat || msg.key.remoteJid;

        try {
            // 1. Command එක ආපු ගමන් User ගේ Message එකට 💀 React කරනවා (Non-blocking)
            sock.sendMessage(chatJid, {
                react: { text: "💀", key: msg.key }
            }).catch(() => {});

            let sentMsg = await sock.sendMessage(chatJid, { 
                text: "```💻 [ INITIATING CYBER ATTACK ]\n\n💉 Injecting Malware...```" 
            }, { quoted: msg });

            if (!sentMsg?.key) return;

            // ඔයාගේ මුල් steps 18 ම සම්පූර්ණයෙන්ම මෙතන තියෙනවා
            const steps = [
                "💉 Injecting Malware...",
                "█ 10%",
                "█ █ 20%",
                "█ █ █ 30%",
                "█ █ █ █ 40%",
                "█ █ █ █ █ 50%",
                "█ █ █ █ █ █ 60%",
                "█ █ █ █ █ █ █ 70%",
                "█ █ █ █ █ █ █ █ 80%",
                "█ █ █ █ █ █ █ █ █ 90%",
                "█ █ █ █ █ █ █ █ █ █ 100%",
                "⚙️ System hijacking in process...\n🌐 Connecting to remote server...",
                "📡 Device successfully connected...\n📥 Receiving private data...",
                "📂 Data extraction 100% completed!\n🧹 Killing evidence & removing malwares...",
                "💀 HACKING COMPLETED BY HESHAN-MD",
                "📤 Sending log documents to C2 server...",
                "✅ Successfully sent data. Connection terminated!",
                "🔒 ALL BACKLOGS CLEARED & TRACES REMOVED!"
            ];

            for (const step of steps) {
                await delay(550); // Speed එක සහ safety එකට ගැලපෙන smooth delay එකක්
                try {
                    await sock.sendMessage(chatJid, {
                        text: `\`\`\`${step}\`\`\``,
                        edit: sentMsg.key
                    });
                } catch (editErr) {
                    // Message edit fail වුණත් bot freeze නොවී ඉදිරියට යයි
                }
            }

            // 2. සියල්ල අවසන් වූ පසු අන්තිම Message එකට ☠️ React කරනවා
            sock.sendMessage(chatJid, {
                react: { text: "☠️", key: sentMsg.key }
            }).catch(() => {});

        } catch (err) {
            console.error('Hack Command Error:', err?.message || err);
        }
    }
};
