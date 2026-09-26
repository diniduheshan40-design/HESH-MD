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

    // 1. Initial Reaction
    await sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    try {
      const start = performance.now();

      // 2. Initial Testing Message
      const testMsg = await sock.sendMessage(targetChat, { 
        text: '⚡ `[ PINGING... ]`' 
      }, { quoted: msg }).catch(async () => {
        return await sock.sendMessage(targetChat, { 
          text: '⚡ `[ PINGING... ]`' 
        }).catch(() => null);
      });

      // 3. Latency Calculation
      const end = performance.now();
      const speed = Math.round(end - start);

      // Speed එක අනුව status එක සහ icon එක තේරීම
      const status = speed < 300 ? '🚀 ᴜʟᴛʀᴀ-ꜰᴀꜱᴛ' : speed < 700 ? '⚡ ꜱᴛᴀʙʟᴇ' : '⏳ ᴅᴇʟᴀʏ';

      // 🔥 Clean Single Line Design
      const pingText = `⚡ ʀᴇꜱᴘᴏɴꜱᴇ: \`${speed}ms\` ┃ ${status} ┃ ✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ`;

      // 4. Edit Message
      if (testMsg?.key) {
        await sock.sendMessage(targetChat, { 
          text: pingText, 
          edit: testMsg.key 
        }).catch(async () => {
          await sock.sendMessage(targetChat, { text: pingText }, { quoted: msg });
        });

        await sock.sendMessage(targetChat, { react: { text: "🎯", key: testMsg.key } }).catch(() => {});
      } else {
        const sent = await sock.sendMessage(targetChat, { text: pingText }, { quoted: msg });
        if (sent?.key) {
          await sock.sendMessage(targetChat, { react: { text: "🎯", key: sent.key } }).catch(() => {});
        }
      }

    } catch (err) {
      console.error('Ping command error:', err?.message || err);
      await sock.sendMessage(targetChat, { text: '⚡ `Error measuring ping!`' }).catch(() => {});
    }
  }
};
