// commands/pairbot.js
const fetch = require('node-fetch');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// 👑 ROOT DEVELOPER NUMBER
const DEVELOPER_NUMBER = '94719845166';

module.exports = {
  name: 'code',
  alias: ['bot', 'pair', 'getcode', 'paircode'],
  category: 'tools',
  desc: 'Generate WhatsApp pairing code directly inside WhatsApp',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (content) => {
      if (typeof safeReply === 'function' && typeof content === 'string') return await safeReply(content);
      const payload = typeof content === 'string' ? { text: content } : content;
      return await sock.sendMessage(targetChat, { ...payload, ...(global.channelContext || {}) }, { quoted: msg });
    };

    const rawText = (
      msg.message?.conversation || 
      msg.message?.extendedTextMessage?.text || 
      ''
    ).trim();

    const usedPrefixCmd = rawText.split(/\s+/)[0].toLowerCase();
    const isCodeCommand = usedPrefixCmd.endsWith('code');

    // ⚡ 1. SENDER RESOLUTION (Group / Private / LID Support)
    const isGroup = targetChat.endsWith('@g.us');
    let senderJid = isGroup 
      ? (msg.key?.participant || msg.participant || '') 
      : (msg.key?.fromMe ? (sock.user?.id || '') : targetChat);

    if (senderJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
      try {
        const resolved = await sock.signalRepository.lidToJid(senderJid);
        if (resolved) senderJid = resolved;
      } catch (e) {}
    }

    const cleanSenderNum = jidNormalizedUser(senderJid).replace(/\D/g, '');
    const isDeveloper = cleanSenderNum === DEVELOPER_NUMBER;

    // ⛔ 2. DEVELOPER-ONLY COMMAND RESTRICTION (/code හෝ .code)
    if (isCodeCommand && !isDeveloper) {
      return await reply('⛔ *Access Denied!* `/code` command එක භාවිත කළ හැක්කේ ප්‍රධාන Developer හට පමණි (+94719845166). සාමාන්‍ය භාවිතය සඳහා `.bot` යොදන්න.');
    }

    // ⚡ 3. NUMBER EXTRACTION
    // args වලින් අංකයක් දී ඇත්නම් එය ගනී, නැතහොත් sender ගේ අංකය auto තෝරාගනී
    let inputNumber = (Array.isArray(args) ? args.join('') : String(args || '')).replace(/\D/g, '');

    if (!inputNumber || inputNumber.length < 9) {
      inputNumber = cleanSenderNum;
    }

    // Sender එකෙනුත් නිවැරදි අංකයක් හමු නොවුවහොත් පමණක් error පෙන්වයි
    if (!inputNumber || inputNumber.length < 9) {
      return await reply(
        `╭───❮ ⚡ *HESHAN-MD PAIRING* ⚡ ❯───╮\n` +
        `│\n` +
        `│ ⚠️ *ඔබගේ WhatsApp අංකය හඳුනාගත නොහැකි විය!*\n` +
        `│ 💡 *භාවිතය:*\n` +
        `│ • \`.bot\` (ඔබගේම අංකයට Code එකක් ලබාගැනීමට)\n` +
        `│ • \`.bot 9471xxxxxxx\` (අවශ්‍ය අංකයක් ලබාදීමට)\n` +
        `│\n` +
        `╰────────────────────────────────╯\n` +
        `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ⚡`
      );
    }

    sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    let waitMsg = await sock.sendMessage(targetChat, {
      text: `🔄 *Generating Pairing Code for +${inputNumber}...*\nකරුණාකර තත්පර කිහිපයක් රැඳී සිටින්න... ⏳`,
      ...(global.channelContext || {})
    }, { quoted: msg }).catch(() => null);

    try {
      const port = process.env.PORT || 3000;
      const response = await fetch(`http://127.0.0.1:${port}/pair?num=${inputNumber}`, { timeout: 40000 });
      const data = await response.json();

      if (waitMsg?.key) {
        await sock.sendMessage(targetChat, { delete: waitMsg.key }).catch(() => {});
      }

      if (data && data.code) {
        const pairCode = data.code;

        const infoCard = 
`╭───❮ ⚡ *HESHAN-MD PAIRING CODE* ⚡ ❯───╮
│
├ 📱 *Target Number :* +${inputNumber}
├ 🔑 *Pairing Code  :* \`${pairCode}\`
├ ⏱️ *Valid Time    :* 60 Seconds
│
├──────❮ 📌 *සම්බන්ධ වන ආකාරය* ❯──────╮
│
│  1. WhatsApp Settings වෙත යන්න.
│  2. *Linked Devices* තෝරන්න.
│  3. *Link with phone number instead* ඔබන්න.
│  4. පහතින් ලැබෙන Code එක ඇතුළත් කරන්න.
│
╰───────────────────────────────────────╯
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ⚡`.trim();

        await reply(infoCard);

        // Click-to-copy code
        await sock.sendMessage(targetChat, {
          text: `${pairCode}`
        }, { quoted: msg });

        sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      } else {
        sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
        await reply(`❌ *Error:* ${data.error || 'Pairing code ලබාගත නොහැකි විය. තත්පර 15කින් නැවත උත්සාහ කරන්න.'}`);
      }

    } catch (err) {
      console.error('Pairbot error:', err?.message || err);
      if (waitMsg?.key) {
        await sock.sendMessage(targetChat, { delete: waitMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply('❌ *Server Error:* Pairing engine එක busy වී ඇත. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.');
    }
  }
};
