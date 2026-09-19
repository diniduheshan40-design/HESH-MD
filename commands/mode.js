// commands/mode.js
const mongoose = require('mongoose');

const OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '72787431583987'
];

module.exports = {
  name: 'mode',
  alias: ['workmode', 'setmode'],
  category: 'owner',
  desc: 'Change bot operation mode (Public, Private, Groups)',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = chatJid || msg.key.remoteJid;
    const isGroup = targetChat.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || '') : targetChat;

    // ⚡ Real Owner Resolution
    const isOwner = options.isOwner || 
                    msg.key.fromMe || 
                    OWNER_NUMBERS.some(num => String(sender).includes(num));

    const reply = async (content) => {
      if (safeReply) return await safeReply(content);
      const payload = typeof content === 'string' ? { text: content } : content;
      return await sock.sendMessage(targetChat, payload, { quoted: msg });
    };

    if (!isOwner) {
      return await reply("⛔ *Access Denied!* Only the bot owner can change settings.");
    }

    // Identify active bot number
    const botNum = sock.user?.id
      ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '')
      : '';

    const SettingsModel = mongoose.models.BotSettings;
    const inputMode = args[0]?.toLowerCase()?.trim();

    // Valid modes mapping
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
        // ⚡ Update MongoDB Settings
        if (SettingsModel && botNum) {
          await SettingsModel.findByIdAndUpdate(
            botNum,
            { $set: { workMode: selectedMode } },
            { upsert: true }
          );
        }

        // ⚡ Invalidate NodeCache so index.js reads updated mode instantly
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
      // Fetch current active mode from Database
      let currentMode = 'PUBLIC';
      try {
        if (SettingsModel && botNum) {
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
