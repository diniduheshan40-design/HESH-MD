module.exports = {
    name: 'ping',
    async execute(sock, msg, args, targetChat) {
        const chatJid = targetChat || msg.key.remoteJid;
        const start = Date.now();

        try {
            // 1. Command එක ආපු ගමන් ⚡ React කරනවා
            await sock.sendMessage(chatJid, {
                react: {
                    text: "⚡",
                    key: msg.key
                }
            });

            // 2. Testing පණිවිඩය යවනවා
            const sentMsg = await sock.sendMessage(chatJid, { 
                text: "*Testing... ⚡*" 
            }, { quoted: msg });

            // Latency ගණනය කිරීම
            const latency = Date.now() - start;

            // 3. කලින් දාපු ⚡ reaction එක අයින් කරනවා (Remove reaction)
            try {
                await sock.sendMessage(chatJid, {
                    react: {
                        text: "",
                        key: msg.key
                    }
                });
            } catch (rErr) {
                // Reaction remove එක fail වුණත් bot එක හිර නොවී ඉදිරියට යයි
            }

            // 4. Message එක Edit කර latency එක පෙන්වීම
            try {
                await sock.sendMessage(chatJid, {
                    text: `*speed ${latency}ms 📍*`,
                    edit: sentMsg.key
                });
            } catch (editErr) {
                // Edit fail වුවහොත් fallback එකක් ලෙස අලුත් msg එකක් යවයි
                await sock.sendMessage(chatJid, {
                    text: `*speed ${latency}ms 📍*`
                }, { quoted: msg });
            }

            // 5. වැඩේ සාර්ථකව අවසන් වූ පසු ✅ React කරනවා
            await sock.sendMessage(chatJid, {
                react: {
                    text: "✅",
                    key: msg.key
                }
            });

        } catch (err) {
            console.error('Ping Command Error:', err);
        }
    }
};
