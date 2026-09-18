module.exports = {
  name: 'ping',
  alias: ['speed', 'p'],
  category: 'general',
  desc: 'Check bot response speed',
  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key.remoteJid;

    try {
      const start = Date.now();

      // Reaction යැවීම (Fail වුණත් code එක නතර නොවේ)
      await sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      // Initial Message එක යැවීම
      const sentMsg = await sock.sendMessage(targetChat, { text: "*Testing... ⚡*" }, { quoted: msg });

      const latency = Date.now() - start;

      // WhatsApp server sync delay
      await new Promise(resolve => setTimeout(resolve, 350));

      // Edit කිරීම
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

      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Ping Execution Error:', err);
      // Fallback: Normal message එකක් යැවීම
      try {
        await sock.sendMessage(targetChat, { text: "*Pong! ⚡*" }, { quoted: msg });
      } catch (e) {}
    }
  }
};
