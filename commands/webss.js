const axios = require('axios');

module.exports = {
  name: "ssweb",
  category: "tools",
  desc: "Take webpage screenshot",

  // index.js එකේ format එකට 100% ගැලපෙන විදිහට arguments set කර ඇත
  async run(sock, msg, args, chatJid, reply) {
    try {
      let url = args[0];
      if (!url) {
        return await reply("කරුණාකර Web Link එකක් ලබා දෙන්න!\nඋදා: `.ssweb https://google.com`");
      }

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      await reply("📸 Capturing screenshot, please wait...");

      // Ultra-fast screenshot endpoint (Buffer එකක් නැතුව direct stream වේ)
      const imgUrl = `https://image.thum.io/get/width/1280/crop/800/noanimate/${encodeURIComponent(url)}`;

      await sock.sendMessage(chatJid, {
        image: { url: imgUrl },
        caption: `📸 *SCREENSHOT CAPTURED*\n\n🌐 *URL:* ${url}\n⚡ *Powered by HESHAN-MD*`
      }, { quoted: msg });

    } catch (err) {
      console.error('ssweb error:', err.message);
      await reply("❌ Screenshot ගැනීමට නොහැකි විය! Link එක නිවැරදිදැයි පරීක්ෂා කරන්න.");
    }
  }
};
