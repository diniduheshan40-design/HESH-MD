// commands/ping.js
const { performance } = require('perf_hooks');

module.exports = {
  name: 'ping',
  alias: ['speed', 'p'],
  category: 'general',
  desc: 'Check bot response speed',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // 1. Instant Reaction
    await sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    try {
      const start = performance.now();
      
      // Speed Calculation
      const end = performance.now();
      const speed = (end - start).toFixed(2);

      const pingText = `*⚡ 𝐇𝐄𝐒𝐇𝐀𝐍-𝐌𝐃 𝐒𝐏𝐄𝐄𝐃 ⚡*\n\n` +
                       `🚀 *Response Speed :* ${speed} ms\n` +
                       `📶 *Server Status  :* Active 🟢\n\n` +
                       `> 🔐 *heshan ofc • all rights reserved*`;

      // 2. Safe Message Dispatch (Quoted fail වුවහොත් Plain text යැවීම)
      await sock.sendMessage(targetChat, { text: pingText }, { quoted: msg }).catch(async () => {
        await sock.sendMessage(targetChat, { text: pingText }).catch(() => {});
      });

    } catch (err) {
      console.error('Ping command error:', err?.message || err);
      // Fallback
      await sock.sendMessage(targetChat, { text: '🏓 Pong! (Speed check error)' }).catch(() => {});
    }
  }
};
