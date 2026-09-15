module.exports = {
  name: 'ping',
  category: 'general',
  desc: 'Check bot response speed',
  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key.remoteJid;
    const start = Date.now();

    try {
      // 1. Command එක ආපු ගමන් ⚡ React කරනවා
      try {
        await sock.sendMessage(targetChat, {
          react: {
            text: "⚡",
            key: msg.key
          }
        });
      } catch (e) {}

      // 2. Testing පණිවිඩය යවනවා
      const sentMsg = await sock.sendMessage(targetChat, { 
        text: "*Testing... ⚡*" 
      }, { quoted: msg });

      // Latency ගණනය කිරීම
      const latency = Date.now() - start;

      // 3. Message එක Edit කර latency එක පෙන්වීම
      try {
        if (sentMsg?.key) {
          await sock.sendMessage(targetChat, {
            text: `*speed ${latency}ms 📍*`,
            edit: sentMsg.key
          });
        } else {
          await sock.sendMessage(targetChat, {
            text: `*speed ${latency}ms 📍*`
          }, { quoted: msg });
        }
      } catch (editErr) {
        await sock.sendMessage(targetChat, {
          text: `*speed ${latency}ms 📍*`
        }, { quoted: msg });
      }

      // 4. වැඩේ සාර්ථකව අවසන් වූ පසු ✅ React කරනවා
      try {
        await sock.sendMessage(targetChat, {
          react: {
            text: "✅",
            key: msg.key
          }
        });
      } catch (e) {}

    } catch (err) {
      console.error('Ping Command Error:', err.message);
    }
  }
};
