module.exports = {
  name: 'rates',
  alias: ['packages', 'coinprice', 'coins'],
  category: 'general',
  description: 'View boost rates and prices',
  async execute({ sock, msg }) {
    const rateText = `*✦ CHANNEL BOOST PRICING LIST ✦*
━━━━━━━━━━━━━━━━━━━━━━━━━━
🪙 *REACT PACKAGES:*
• 50 Reacts   ⇛ *5 Coins*
• 100 Reacts  ⇛ *10 Coins*
• 300 Reacts  ⇛ *15 Coins*
• 400 Reacts  ⇛ *25 Coins*

👥 *FOLLOW PACKAGES:*
• 100 Follows ⇛ *100 Coins*
• 200 Follows ⇛ *200 Coins*
• 300 Follows ⇛ *250 Coins* 🔥
• 400 Follows ⇛ *320 Coins* 🔥
━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 *How to Order:*
*.boost react <link> <emoji> <qty>*
*.boost follow <link> <qty>*

> Contact Developer to buy Coins!`.trim();

    await sock.sendMessage(msg.key.remoteJid, { text: rateText }, { quoted: msg });
  }
};
