// commands/pairbot.js
const fetch = require('node-fetch');

const MASTER_OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '72787431583987'
];

module.exports = {
  name: 'code',
  alias: ['bot', 'pair', 'getcode', 'paircode'],
  category: 'tools',
  desc: 'Generate WhatsApp pairing code directly inside WhatsApp',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    const isOwnerCommand = rawText.startsWith('/code') || rawText.startsWith('.code');

    // ⚡ Sender identification (Group හෝ Private chat)
    const rawParticipant = msg.key?.participant || msg.participant || targetChat || '';
    const cleanSender = rawParticipant.replace(/[^0-9]/g, '');

    const isMasterOwner = Boolean(
      MASTER_OWNER_NUMBERS.some(owner => cleanSender.includes(owner) || rawParticipant.includes(owner)) ||
      msg.key?.fromMe ||
      options?.isOwner
    );

    // /code හෝ .code ගැහුවොත් Master Owner පමණක් විය යුතුය
    if (isOwnerCommand && !isMasterOwner) {
      return await sock.sendMessage(targetChat, {
        text: '⛔ *Access Denied!* මෙම command එක භාවිතා කළ හැක්කේ Master Owner හට පමණි.'
      }, { quoted: msg });
    }

    // Number එක extract කිරීම: Args වලින් නම්බර් එකක් දුන්නේ නැත්නම් sender ගේ නම්බර් එක auto ගන්නවා
    let inputNumber = (Array.isArray(args) ? args.join('') : String(args || '')).replace(/[^0-9]/g, '');

    if (!inputNumber || inputNumber.length < 10) {
      inputNumber = cleanSender;
    }

    // Sender එකෙනුත් valid නම්බර් එකක් හමු නොවුණහොත් පමණක් error පෙන්වයි
    if (!inputNumber || inputNumber.length < 10) {
      const exampleCmd = isMasterOwner ? '/code 9471xxxxxxx' : '.bot';
      return await sock.sendMessage(targetChat, {
        text: `╭───❮ ⚡ *HESHAN-MD PAIRING* ⚡ ❯───╮
│
│ ⚠️ *ඔබගේ WhatsApp අංකය හඳුනාගත නොහැකි විය!*
│ 💡 *භාවිතය:* \`${exampleCmd}\` හෝ \`.bot 9471xxxxxxx\`
│
╰────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: global.channelContext?.contextInfo || {}
      }, { quoted: msg });
    }

    sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    let waitMsg = await sock.sendMessage(targetChat, {
      text: `🔄 *Generating Pairing Code for +${inputNumber}...*\nකරුණාකර තත්පර කිහිපයක් රැඳී සිටින්න... ⏳`
    }, { quoted: msg }).catch(() => null);

    try {
      const port = process.env.PORT || 3000;
      const response = await fetch(`http://127.0.0.1:${port}/pair?num=${inputNumber}`, { timeout: 35000 });
      const data = await response.json();

      if (waitMsg?.key) {
        await sock.sendMessage(targetChat, { delete: waitMsg.key }).catch(() => {});
      }

      if (data && data.code) {
        const pairCode = data.code;

        const infoCard = `╭───❮ ⚡ *HESHAN-MD PAIRING CODE* ⚡ ❯───╮
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
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

        await sock.sendMessage(targetChat, {
          text: infoCard,
          contextInfo: global.channelContext?.contextInfo || {}
        }, { quoted: msg });

        // ක්ෂණිකව Copy කරගැනීමට Code එක පමණක් වෙනම යැවීම
        await sock.sendMessage(targetChat, {
          text: `${pairCode}`
        }, { quoted: msg });

        sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      } else {
        sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
        await sock.sendMessage(targetChat, {
          text: `❌ *Error:* ${data.error || 'Pairing code ලබාගත නොහැකි විය. තත්පර 15කින් නැවත උත්සාහ කරන්න.'}`
        }, { quoted: msg });
      }

    } catch (err) {
      console.error('Pairbot error:', err.message);
      if (waitMsg?.key) {
        await sock.sendMessage(targetChat, { delete: waitMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, {
        text: `❌ *Server Error:* Pairing engine එක busy වී ඇත. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න.`
      }, { quoted: msg });
    }
  }
};

