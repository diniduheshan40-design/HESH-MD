// commands/hack.js
const { delay } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'hack',
  alias: ['cyberhack', 'terminal'],
  category: 'fun',
  desc: 'Prank cyber terminal hack animation',

  async execute(sock, msg, args, chatJid) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    try {
      // 1. Initial React
      sock.sendMessage(targetChat, {
        react: { text: "💀", key: msg.key }
      }).catch(() => {});

      let sentMsg = await sock.sendMessage(targetChat, { 
        text: "```💻 [ INITIATING CYBER ATTACK ]\n\n💉 Injecting Malware...```",
        ...(global.channelContext || {})
      }, { quoted: msg }).catch(() => null);

      if (!sentMsg?.key) return;

      const steps = [
        "💉 Injecting Malware...",
        "█ 10%",
        "█ █ 20%",
        "█ █ █ 30%",
        "█ █ █ █ 40%",
        "█ █ █ █ █ 50%",
        "█ █ █ █ █ █ 60%",
        "█ █ █ █ █ █ █ 70%",
        "█ █ █ █ █ █ █ █ 80%",
        "█ █ █ █ █ █ █ █ █ 90%",
        "█ █ █ █ █ █ █ █ █ █ 100%",
        "⚙️ System hijacking in process...\n🌐 Connecting to remote server...",
        "📡 Device successfully connected...\n📥 Receiving private data...",
        "📂 Data extraction 100% completed!\n🧹 Killing evidence & removing malwares...",
        "💀 HACKING COMPLETED BY HESHAN-MD",
        "📤 Sending log documents to C2 server...",
        "✅ Successfully sent data. Connection terminated!",
        "🔒 ALL BACKLOGS CLEARED & TRACES REMOVED!"
      ];

      for (const step of steps) {
        await delay(800); // WhatsApp spam protection safe rate
        try {
          await sock.sendMessage(targetChat, {
            text: `\`\`\`${step}\`\`\``,
            edit: sentMsg.key
          });
        } catch (editErr) {
          // Message edit drop වුවහොත් loop එක බිඳ නොවැටී ඉදිරියට යයි
        }
      }

      // 2. Final React
      sock.sendMessage(targetChat, {
        react: { text: "☠️", key: sentMsg.key }
      }).catch(() => {});

    } catch (err) {
      console.error('Hack Command Error:', err?.message || err);
    }
  }
};
