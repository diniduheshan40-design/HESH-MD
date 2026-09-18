module.exports = {
  name: 'ping',
  category: 'general',
  desc: 'Check bot response speed',
  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key.remoteJid;
    const cmdReceivedAt = Date.now();

    try {
      // 🟢 1. React සහ Initial Message එක එකවර (Parallel) යැවීම — Speed වැඩිකිරීමට
      const sendStart = Date.now();

      const [_, sentMsg] = await Promise.all([
        sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {}),
        sock.sendMessage(targetChat, { text: "*Testing... ⚡*" }, { quoted: msg })
      ]);

      // 🟢 2. Real Latency ගණනය කිරීම (Message යැවීමට ගත වුණ කාලය)
      const sendLatency = Date.now() - sendStart;

      // 🟢 3. Edit කිරීමේ Latency එකත් වෙන වෙනම මැනීම (Round-trip accuracy)
      const editStart = Date.now();
      let editSuccess = false;

      if (sentMsg?.key) {
        try {
          await sock.sendMessage(targetChat, {
            text: `*speed ${sendLatency}ms 📍*`,
            edit: sentMsg.key
          });
          editSuccess = true;
        } catch (editErr) {}
      }

      if (!editSuccess) {
        await sock.sendMessage(targetChat, {
          text: `*speed ${sendLatency}ms 📍*`
        }, { quoted: msg });
      }

      // 🟢 4. Total round-trip time (command ආපු තැන ඉඳන් සම්පූර්ණ වෙන තුරු)
      const totalLatency = Date.now() - cmdReceivedAt;

      // 🟢 5. Success React — Fire-and-forget (Response block කරන්නේ නෑ)
      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      console.log(`[PING] Send: ${sendLatency}ms | Total: ${totalLatency}ms`);

    } catch (err) {
      console.error('Ping Command Error:', err.message);
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
    }
  }
};
