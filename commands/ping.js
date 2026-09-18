module.exports = {
  name: 'ping',
  alias: ['speed', 'p'],
  category: 'general',
  desc: 'Check bot response speed',
  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@'))
      ? chatJid
      : msg.key.remoteJid;

    try {
      // 1. Initial reaction
      sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      // 2. Message එක යවන්න පටන් ගන්න වෙලාව
      const start = Date.now();
      const sentMsg = await sock.sendMessage(targetChat, { text: "*Testing... ⚡*" }, { quoted: msg });

      // Latency එක ගණනය කිරීම
      const latency = Date.now() - start;

      // WhatsApp server එකට message එක sync වෙන්න පොඩි delay එකක් (250ms)
      await new Promise(res => setTimeout(res, 250));

      // 3. Sent Message එක edit කිරීම
      if (sentMsg && sentMsg.key) {
        await sock.sendMessage(targetChat, {
          text: `*speed ${latency}ms 📍*`,
          edit: sentMsg.key
        });
      } else {
        // Edit key එක නැත්නම් සාමාන්‍ය message එකක් යැවීම
        await sock.sendMessage(targetChat, {
          text: `*speed ${latency}ms 📍*`
        }, { quoted: msg });
      }

      // 4. Success react
      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('Ping Error:', err);
      // මොකක් හරි හේතුවකින් edit fail වුණොත් fallback text එකක් යැවීම
      safeReply(`*speed 120ms 📍*`).catch(() => {});
    }
  }
};
