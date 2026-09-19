// commands/settings.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Safe Model Extraction (Prevents OverwriteModelError)
const SettingsModel = mongoose.models.BotSettings || mongoose.model('BotSettings', new mongoose.Schema({
  _id: { type: String, required: true },
  workMode: { type: String, default: 'public' },
  autoAiInbox: { type: Boolean, default: true },
  autoStatusSeen: { type: Boolean, default: true },
  statusReact: { type: Boolean, default: true },
  statusReactEmoji: { type: String, default: '💐' },
  ownerReact: { type: Boolean, default: true },
  ownerReactEmoji: { type: String, default: '👑' },
  botLogo: { type: String, default: './assets/logo.jpg' },
  autoPresence: { type: String, default: 'off' },
  securityPin: { type: String, default: '1234' },
  isFirstConnectDone: { type: Boolean, default: false }
}, { strict: false }));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let cachedLogo = null;
function getBotLogo() {
  if (cachedLogo) return cachedLogo;
  try {
    const localLogoPath = path.join(process.cwd(), 'assets', 'logo.jpg');
    if (fs.existsSync(localLogoPath)) return (cachedLogo = fs.readFileSync(localLogoPath));
    const rootPath = path.join(process.cwd(), 'logo.jpg');
    if (fs.existsSync(rootPath)) return (cachedLogo = fs.readFileSync(rootPath));
  } catch (e) {}
  return { url: 'https://raw.githubusercontent.com/diniduheshan40-design/HESH-MD/main/logo.jpg' };
}

module.exports = {
  name: 'settings',
  alias: ['setting', 'set', 'config'],
  category: 'owner',
  description: 'Manage individual bot settings',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = chatJid || msg.key.remoteJid;
    const isOwner = options.isOwner || msg.key.fromMe;

    const reply = async (content) => {
      if (typeof safeReply === 'function') return await safeReply(content);
      const payload = typeof content === 'string' ? { text: content } : content;
      return await sock.sendMessage(targetChat, payload, { quoted: msg });
    };

    if (!isOwner) {
      return await reply('⛔ *Access Denied!* Only Bot Controller can modify settings.');
    }

    // Dynamic Bot Number Fetch
    const rawBotId = sock.user?.id || '';
    const botNumber = rawBotId.split(':')[0].split('@')[0].replace(/[^0-9]/g, '');
    if (!botNumber) return await reply('⚠️ Bot Number හඳුනාගත නොහැකි විය.');

    let settings = await SettingsModel.findById(botNumber);
    if (!settings) {
      settings = await SettingsModel.create({ _id: botNumber });
    }

    // Extract Clean Input String
    let input = "";
    if (args && args.length > 0) {
      input = args.join(' ').trim().toLowerCase();
    } else {
      const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      input = rawText.trim().toLowerCase().replace(/^[./!#]?(settings|setting|set|config)\s*/i, '').trim();
    }

    let isUpdated = false;

    // 1. WORK MODE
    if (input === '1.1') { settings.workMode = 'private'; isUpdated = true; }
    else if (input === '1.2') { settings.workMode = 'public'; isUpdated = true; }
    else if (input === '1.3') { settings.workMode = 'inbox'; isUpdated = true; }
    else if (input === '1.4') { settings.workMode = 'groups'; isUpdated = true; }

    // 2. AUTO AI INBOX
    else if (input === '2.1') { settings.autoAiInbox = true; isUpdated = true; }
    else if (input === '2.2') { settings.autoAiInbox = false; isUpdated = true; }

    // 3. AUTO STATUS SEEN
    else if (input === '3.1') { settings.autoStatusSeen = true; isUpdated = true; }
    else if (input === '3.2') { settings.autoStatusSeen = false; isUpdated = true; }

    // 4. STATUS REACT
    else if (input === '4.1') { settings.statusReact = true; isUpdated = true; }
    else if (input === '4.2') { settings.statusReact = false; isUpdated = true; }

    // 5. FAKE ACTION
    else if (input === '5.1') { settings.autoPresence = 'composing'; isUpdated = true; }
    else if (input === '5.2') { settings.autoPresence = 'recording'; isUpdated = true; }
    else if (input === '5.3') { settings.autoPresence = 'off'; isUpdated = true; }

    // 6. OWNER EMOJI
    else if (input.startsWith('6')) {
      const parts = input.split(/\s+/);
      const emoji = parts[1];
      if (!emoji) return await reply('⚠️ කරුණාකර Emoji එකක් ලබාදෙන්න! (උදා: `.set 6 🔥`)');
      settings.ownerReactEmoji = emoji;
      isUpdated = true;
    }

    // 7. CHANGE PIN
    else if (input.startsWith('pin')) {
      const parts = input.split(/\s+/);
      const newPin = parts[1];
      if (!newPin || newPin.length < 4) return await reply('⚠️ අවම අංක 4ක PIN එකක් දෙන්න! (උදා: `pin 7788`)');
      settings.securityPin = newPin;
      isUpdated = true;
    }

    if (isUpdated) {
      await SettingsModel.findByIdAndUpdate(botNumber, { $set: settings.toObject() }, { upsert: true });

      if (typeof global.clearSettingsCache === 'function') {
        global.clearSettingsCache(botNumber);
      }

      const modeBadge = {
        public: 'PUBLIC 🌐',
        private: 'PRIVATE 🔒',
        inbox: 'INBOX 📥',
        groups: 'GROUPS 👥'
      }[settings.workMode || 'public'] || 'PUBLIC 🌐';

      const presenceBadge = {
        composing: 'TYPING ✍️',
        recording: 'RECORDING 🎙️',
        off: 'OFF 🔴'
      }[settings.autoPresence || 'off'] || 'OFF 🔴';

      const statusText = `✅ *[+${botNumber}]* Settings යාවත්කාලීන විය!\n\n` +
                         `• Work Mode: *${modeBadge}*\n` +
                         `• Fake Action: *${presenceBadge}*\n` +
                         `• AI Inbox: *${settings.autoAiInbox ? 'ON 🟢' : 'OFF 🔴'}*\n` +
                         `• Status Seen: *${settings.autoStatusSeen ? 'ON 🟢' : 'OFF 🔴'}*`;

      try {
        const initialMsg = await sock.sendMessage(targetChat, { text: "🔄 *Updating Bot Settings...*" }, { quoted: msg });
        await sleep(350);
        return await sock.sendMessage(targetChat, { text: statusText, edit: initialMsg.key });
      } catch (e) {
        return await reply(statusText);
      }
    }

    // RENDER MENU
    const stateBadge = (val) => (val !== false ? '🟢 ON' : '🔴 OFF');
    const modeBadge = {
      public: 'PUBLIC 🌐',
      private: 'PRIVATE 🔒',
      inbox: 'INBOX 📥',
      groups: 'GROUPS 👥'
    }[settings.workMode || 'public'] || 'PUBLIC 🌐';

    const presenceBadge = {
      composing: 'TYPING ✍️',
      recording: 'RECORDING 🎙️',
      off: 'OFF 🔴'
    }[settings.autoPresence || 'off'] || 'OFF 🔴';

    const menu = `╭─── ⚡ *HESHAN-MD SYSTEM SETTINGS* ⚡ ───╮
│
├ 🤖 *Target Session :* +${botNumber}
├ 🛡️ *Master Access  :* Verified
├ 🔐 *Security PIN   :* ${settings.securityPin || '1234'}
│
├─◈ *1. WORK MODE* ⤿ [ ${modeBadge} ]
│  ├ 1.1 Private
│  ├ 1.2 Public
│  ├ 1.3 Inbox Only
│  └ 1.4 Group Only
│
├─◈ *2. AUTO AI INBOX* ⤿ [ ${stateBadge(settings.autoAiInbox)} ]
│  ├ 2.1 Turn AI On
│  └ 2.2 Turn AI Off
│
├─◈ *3. AUTO STATUS SEEN* ⤿ [ ${stateBadge(settings.autoStatusSeen)} ]
│  ├ 3.1 Status Seen On
│  └ 3.2 Status Seen Off
│
├─◈ *4. STATUS REACTION* ⤿ [ ${stateBadge(settings.statusReact)} ]
│  ├ 4.1 React On
│  └ 4.2 React Off
│
├─◈ *5. FAKE ACTION* ⤿ [ ${presenceBadge} ]
│  ├ 5.1 Fake Typing ✍️
│  ├ 5.2 Fake Recording 🎙️
│  └ 5.3 Turn Off 🔴
│
├─◈ *6. OWNER EMOJI* ⤿ [ ${settings.ownerReactEmoji || '👑'} ]
│  └ ✦ Type: .set 6 <emoji>
│
├─◈ *7. CHANGE PIN* ⤿ [ ${settings.securityPin || '1234'} ]
│  └ ✦ Type: .set pin <new_pin>
│
╰────────────────────────────────╯
💡 *පාලනය කිරීමට:*
• අදාළ Option අංකය කෙලින්ම Reply කරන්න (උදා: *3.1* හෝ *5.1*)

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

    try {
      return await sock.sendMessage(targetChat, {
        image: getBotLogo(),
        caption: menu,
        mimetype: 'image/jpeg'
      }, { quoted: msg });
    } catch (err) {
      return await reply(menu);
    }
  }
};

