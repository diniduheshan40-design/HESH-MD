module.exports = {
  name: 'ping',
  alias: ['speed', 'p'],
  category: 'general',
  desc: 'Check bot response speed',
  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@'))
      ? chatJid
      : msg.key.remoteJid;

    const cmdReceivedAt = Date.now();

    try {
      // 🟢 1. React එක සහ Initial "Testing..." Message එක යැවීම
      sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      const sendStart = Date.now();
      const sentMsg = await sock.sendMessage(targetChat, { text: "*Testing... ⚡*" }, { quoted: msg });

      // 🟢 2. Real Latency එක ගණනය කිරීම
      const latency = Date.now() - sendStart;
      let editSuccess = false;

      // 🟢 3. Message එක Edit කර Speed එක පෙන්වීම
      if (sentMsg?.key) {
        try {
          await sock.sendMessage(targetChat, {
            text: `*speed ${latency}ms 📍*`,
            edit: sentMsg.key
          });
          editSuccess = true;
        } catch (editErr) {}
      }

      // Edit එක fail වුණොත් fallback එකක් විදියට අලුත් message එකක් යැවීම
      if (!editSuccess) {
        await sock.sendMessage(targetChat, {
          text: `*speed ${latency}ms 📍*`
        }, { quoted: msg });
      }

      // 🟢 4. Success Reaction
      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      const totalTime = Date.now() - cmdReceivedAt;
      console.log(`[PING] Latency: ${latency}ms | Total: ${totalTime}ms`);

    } catch (err) {
      console.error('Ping Command Error:', err.message);
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
    }
  }
};
