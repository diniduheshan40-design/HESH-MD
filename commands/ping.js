// commands/ping.js
module.exports = {
  name: 'ping',
  alias: ['speed', 'p'],
  category: 'general',
  desc: 'Check bot response speed',

  async execute(sock, msg, args, chatJid) {
    const targetChat = chatJid || msg.key.remoteJid;
    const start = Date.now();

    // Fast Non-blocking Reaction
    sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    try {
      const sentMsg = await sock.sendMessage(targetChat, { 
        text: "*Testing... ⚡*" 
      }, { quoted: msg });

      const latency = Date.now() - start;

      if (sentMsg?.key) {
        await sock.sendMessage(targetChat, {
          text: `*speed ${latency}ms 📍*`,
          edit: sentMsg.key
        });
      }

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Ping Execution Error:', err?.message || err);
      const fallbackLatency = Date.now() - start;
      await sock.sendMessage(targetChat, { 
        text: `*speed ${fallbackLatency}ms 📍*` 
      }, { quoted: msg }).catch(() => {});
    }
  }
};
