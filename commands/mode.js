// commands/mode.js
const mongoose = require('mongoose');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// 👑 ROOT DEVELOPER NUMBER
const DEVELOPER_NUMBER = '94719845166';

const OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '72787431583987'
];

function getSettingsModel() {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    return mongoose.models.BotSettings || mongoose.model('BotSettings');
  } catch (e) {
    return null;
  }
}

module.exports = {
  name: 'mode',
  alias: ['workmode', 'setmode'],
  category: 'owner',
  desc: 'Change bot operation mode (Public, Private, Groups, Inbox)',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (content) => {
      if (typeof safeReply === 'function') return await safeReply(content);
      const payload = typeof content === 'string' ? { text: content } : content;
      return await sock.sendMessage(targetChat, { ...payload, ...(global.channelContext || {}) }, { quoted: msg });
    };

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

    // ⚡ 2. DEVELOPER & OWNER VERIFICATION
    const isDeveloper = cleanSenderNum === DEVELOPER_NUMBER;
    const isOwner = Boolean(
      isDeveloper ||
      options.isOwner || 
      msg.key?.fromMe || 
      OWNER_NUMBERS.some(num => cleanSenderNum === num.replace(/\D/g, ''))
    );

    if (!isOwner) {
      return await reply("⛔ *Access Denied!* බොට්ගේ Mode එක වෙනස් කළ හැක්කේ Owner හට පමණි.");
    }

    // Active bot number හඳුනා ගැනීම
    const myBotJid = jidNormalizedUser(sock.user?.id || '');
    const botNum = myBotJid.replace(/\D/g, '');

    const SettingsModel = getSettingsModel();
    const inputMode = args[0]?.toLowerCase()?.trim();

    // Mode mappings
    const validModes = {
      'public': 'public',
      'private': 'private',
      'self': 'private',
      'group': 'groups',
      'groups': 'groups',
      'inbox': 'inbox'
    };

    if (inputMode && validModes[inputMode]) {
      const selectedMode = validModes[inputMode];

      try {
        if (SettingsModel && botNum) {
          await SettingsModel.findByIdAndUpdate(
            botNum,
            { $set: { workMode: selectedMode } },
            { upsert: true }
          );
        }

        // Cache එක instant clear කර index.js එකට sync කිරීම
        if (typeof global.clearSettingsCache === 'function' && botNum) {
          global.clearSettingsCache(botNum);
        }

        sock.sendMessage(targetChat, { react: { text: "⚙️", key: msg.key } }).catch(() => {});

        const modeDescriptions = {
          'public': 'දැන් ඕනෑම කෙනෙකුට බොට් භාවිත කළ හැක. 🟢',
          'private': 'දැන් බොට් ක්‍රියා කරන්නේ Owner ට පමණි. 🔴',
          'groups': 'බොට් ක්‍රියා කරන්නේ Groups තුළ පමණි. 🟡',
          'inbox': 'බොට් ක්‍රියා කරන්නේ Direct Messages (Inbox) තුළ පමණි. 🔵'
        };

        return await reply(
          `🌐 *BOT MODE UPDATED*\n\n` +
          `• *Mode*   : *${selectedMode.toUpperCase()}*\n` +
          `• *Status* : Active\n` +
          `> ${modeDescriptions[selectedMode]}\n\n` +
          `> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`
        );

      } catch (err) {
        console.error('Mode Update Error:', err?.message || err);
        return await reply(`❌ Settings update failed: ${err.message}`);
      }
    } else {
      let currentMode = 'PUBLIC';
      try {
        if (typeof global.getBotSettings === 'function') {
          const st = await global.getBotSettings(botNum);
          if (st?.workMode) currentMode = st.workMode.toUpperCase();
        } else if (SettingsModel && botNum) {
          const doc = await SettingsModel.findById(botNum).lean();
          if (doc?.workMode) currentMode = doc.workMode.toUpperCase();
        }
      } catch (e) {}

      const panelText = 
`╭───〔 ⚙️ *BOT WORK MODE PANEL* 〕───╮
│
├▸ *Current Mode:* \`${currentMode}\`
│
├─╼〔 *AVAILABLE MODES* 〕
│  ◇ *.mode public*  - Open for everyone
│  ◇ *.mode private* - Owner only
│  ◇ *.mode group*   - Groups only
│  ◇ *.mode inbox*   - Direct Inbox only
│
╰────────────────────────────────╯
> *Usage:* Send \`.mode public\` to switch mode.
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      return await reply(panelText);
    }
  }
};
