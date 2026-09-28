const { cleanDigits } = require('../lib/socket');
const { SettingsModel, clearSettingsCache } = require('../lib/database');

const REAL_OWNER_NUMBER = '94719845166';

module.exports = {
  name: 'sendcoin',
  alias: ['addcoin', 'givecoin'],
  category: 'owner',
  description: 'Send coins to a bot account',
  async execute({ sock, msg, args, senderNumber }) {
    const sender = cleanDigits(senderNumber);
    if (!sender.includes(REAL_OWNER_NUMBER)) {
      return await sock.sendMessage(msg.key.remoteJid, { 
        text: '❌ *Access Denied!* මේ කමාන්ඩ් එක Developer ට පමණි.' 
      }, { quoted: msg });
    }

    const targetNumber = cleanDigits(args[0]);
    const amount = parseInt(args[1], 10);

    if (!targetNumber || targetNumber.length < 10 || isNaN(amount) || amount <= 0) {
      return await sock.sendMessage(msg.key.remoteJid, { 
        text: `*✦ COIN TRANSFER USAGE ✦*\n\n*.sendcoin <number> <amount>*\n\n_උදා: .sendcoin 94719845166 250_` 
      }, { quoted: msg });
    }

    try {
      let targetUser = await SettingsModel.findById(targetNumber);

      if (!targetUser) {
        return await sock.sendMessage(msg.key.remoteJid, { 
          text: `❌ *Error:* +${targetNumber} අංකයට අදාල Bot කෙනෙක් සොයාගත නොහැක.` 
        }, { quoted: msg });
      }

      targetUser.coins = (targetUser.coins || 0) + amount;
      await targetUser.save();
      clearSettingsCache(targetNumber);

      const responseMsg = `*✦ COINS ADDED SUCCESSFULLY ✦*
━━━━━━━━━━━━━━━━━━━━━
• *Receiver* : +${targetNumber}
• *Added*    : +${amount} 🪙
• *Balance*  : ${targetUser.coins} 🪙
• *PW*       : \`${targetUser.botPassword}\`
━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(msg.key.remoteJid, { text: responseMsg }, { quoted: msg });

      const targetJid = `${targetNumber}@s.whatsapp.net`;
      await sock.sendMessage(targetJid, { 
        text: `*🎉 CONGRATULATIONS!*
Developer විසින් ඔබගේ ගිණුමට *${amount} 🪙 Coins* එකතු කරන ලදී!
• වත්මන් Balance: *${targetUser.coins} Coins*` 
      }).catch(() => {});

    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  }
};
