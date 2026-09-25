// commands/ping.js
const { performance } = require('perf_hooks');

module.exports = {
  name: 'ping',
  alias: ['speed', 'p'],
  category: 'general',
  desc: 'Check bot real-time response speed',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // 1. Initial ❄️ Reaction
    await sock.sendMessage(targetChat, { react: { text: "❄️", key: msg.key } }).catch(() => {});

    try {
      const start = performance.now();

      // 2. Real-time Testing Message Dispatch
      const testMsg = await sock.sendMessage(targetChat, { 
        text: 'ms testing...' 
      }, { quoted: msg }).catch(async () => {
        return await sock.sendMessage(targetChat, { 
          text: 'ms testing...' 
        }).catch(() => null);
      });

      // 3. Real Server Latency Calculation
      const end = performance.now();
      const speed = Math.round(end - start);

      const pingText = `pong speed  ${speed}ms 📍`;

      // 4. Update Message & ✔️ Reaction
      if (testMsg?.key) {
        await sock.sendMessage(targetChat, { 
          text: pingText, 
          edit: testMsg.key 
        }).catch(async () => {
          await sock.sendMessage(targetChat, { text: pingText }, { quoted: msg });
        });

        await sock.sendMessage(targetChat, { react: { text: "✔️", key: testMsg.key } }).catch(() => {});
      } else {
        const sent = await sock.sendMessage(targetChat, { text: pingText }, { quoted: msg });
        if (sent?.key) {
          await sock.sendMessage(targetChat, { react: { text: "✔️", key: sent.key } }).catch(() => {});
        }
      }

    } catch (err) {
      console.error('Ping command error:', err?.message || err);
      await sock.sendMessage(targetChat, { text: 'error 📍' }).catch(() => {});
    }
  }
};
