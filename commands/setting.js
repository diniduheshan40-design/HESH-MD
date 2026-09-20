// commands/settings.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');

// In-memory cache to prevent database hammering & freeze
const memSettingsCache = new Map();

// ⚡ Safe Logo Fetcher with Buffer Fallback
let cachedLogo = null;
async function getBotLogo() {
  if (cachedLogo) return cachedLogo;

  try {
    const paths = [
      path.join(process.cwd(), 'logo.jpg'),
      path.join(__dirname, '../logo.jpg'),
      path.join(process.cwd(), 'assets', 'logo.jpg')
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        cachedLogo = fs.readFileSync(p);
        return cachedLogo;
      }
    }
  } catch (e) {
    console.error("Local logo error:", e.message);
  }

  try {
    const fallbackUrl = 'https://raw.githubusercontent.com/diniduheshan40-design/HESH-MD/main/logo.jpg';
    const res = await axios.get(fallbackUrl, { responseType: 'arraybuffer', timeout: 5000 });
    cachedLogo = Buffer.from(res.data, 'binary');
    return cachedLogo;
  } catch (e) {
    console.error("Remote logo fetch failed:", e.message);
    return null;
  }
}

// Safe Mongo Model Lookup Helper (Never crashes)
function getModel() {
  try {
    if (mongoose.connection.readyState !== 1) return null; // DB connected නැතිනම් null
    return mongoose.models.BotSettings || mongoose.model('BotSettings');
  } catch (e) {
    return null;
  }
}

module.exports = {
  name: 'settings',
  alias: ['setting', 'set', 'config'],
  category: 'owner',
  desc: 'Manage individual bot settings',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = chatJid || (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);
    if (!targetChat) return;

    // Identify target bot number safely
    const rawBotId = sock.user?.id || sock.user?.jid || '';
    const botNumber = rawBotId.split(':')[0].split('@')[0].replace(/\D/g, '') || 'default';

    // Flexible Owner Check (msg.key.fromMe හෝ options.isOwner)
    const isOwner = Boolean(options.isOwner || msg.key.fromMe);

    const reply = async (content) => {
      try {
        if (typeof safeReply === 'function') return await safeReply(content);
        const payload = typeof content === 'string' ? { text: content } : content;
        return await sock.sendMessage(targetChat, payload, { quoted: msg });
      } catch (err) {
        console.error("Reply sending failed:", err.message);
      }
    };

    if (!isOwner) {
      return await reply('⛔ *Access Denied!* Only Bot Owner can modify settings.');
    }

    sock.sendMessage(targetChat, { react: { text: "⚙️", key: msg.key } }).catch(() => {});

    const defaultValues = {
      workMode: 'public',
      autoStatusSeen: true,
      statusReact: true,
      statusReactEmoji: '💐',
      autoPresence: 'off',
      securityPin: '1234'
    };

    let settings = { ...defaultValues };

    // 1. Fetch current settings from Memory Cache or Mongo
    if (memSettingsCache.has(botNumber)) {
      settings = Object.assign(settings, memSettingsCache.get(botNumber));
    } else {
      try {
        const SettingsModel = getModel();
        if (SettingsModel) {
          const doc = await SettingsModel.findById(botNumber).lean();
          if (doc) settings = Object.assign(settings, doc);
        }
      } catch (e) {
        console.error("Settings DB Fetch Error:", e.message);
      }
      memSettingsCache.set(botNumber, settings);
    }

    // Input parsing (Supports '.set 1.1' or plain '1.1')
    let input = "";
    if (Array.isArray(args) && args.length > 0) {
      input = args.join(' ').trim().toLowerCase();
    }
    
    if (!input) {
      const rawText = msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text || 
                      '';
      input = rawText.trim().toLowerCase().replace(/^[./!#]?(settings|setting|set|config)\s*/i, '').trim();
    }

    let isUpdated = false;

    // 1. WORK MODE
    if (input === '1.1') { settings.workMode = 'private'; isUpdated = true; }
    else if (input === '1.2') { settings.workMode = 'public'; isUpdated = true; }
    else if (input === '1.3') { settings.workMode = 'inbox'; isUpdated = true; }
    else if (input === '1.4') { settings.workMode = 'groups'; isUpdated = true; }

    // 2. AUTO STATUS SEEN
    else if (input === '2.1') { settings.autoStatusSeen = true; isUpdated = true; }
    else if (input === '2.2') { settings.autoStatusSeen = false; isUpdated = true; }

    // 3. STATUS REACTION
    else if (input === '3.1') { settings.statusReact = true; isUpdated = true; }
    else if (input === '3.2') { settings.statusReact = false; isUpdated = true; }

    // 4. STATUS REACT EMOJI
    else if (input.startsWith('4')) {
      const parts = input.split(' ');
      if (parts[1]) {
        settings.statusReactEmoji = parts[1].trim();
        isUpdated = true;
      } else {
        return await reply('⚠️ කරුණාකර Emoji එකක් ලබාදෙන්න! (උදා: `.set 4 🌸`)');
      }
    }

    // 5. FAKE ACTION (PRESENCE)
    else if (input === '5.1') { settings.autoPresence = 'composing'; isUpdated = true; }
    else if (input === '5.2') { settings.autoPresence = 'recording'; isUpdated = true; }
    else if (input === '5.3') { settings.autoPresence = 'off'; isUpdated = true; }

    // 6. CHANGE PIN
    else if (input.startsWith('pin') || input.startsWith('6')) {
      const parts = input.split(' ');
      const newPin = parts[1] ? parts[1].trim() : '';
      if (newPin && newPin.length >= 4) {
        settings.securityPin = newPin;
        isUpdated = true;
      } else {
        return await reply('⚠️ අවම අංක 4ක PIN එකක් ලබාදෙන්න! (උදා: `.set pin 7788` හෝ `.set 6 7788`)');
      }
    }

    // UPDATE EXECUTOR
    if (isUpdated) {
      memSettingsCache.set(botNumber, settings);

      try {
        const SettingsModel = getModel();
        if (SettingsModel) {
          await SettingsModel.findByIdAndUpdate(
            botNumber,
            { $set: settings },
            { upsert: true, new: true }
          );
        }
      } catch (e) {
        console.error("Settings DB Save Error:", e.message);
      }

      if (typeof global.clearSettingsCache === 'function') {
        global.clearSettingsCache(botNumber);
      }

      const modeBadge = {
        public: 'PUBLIC 🌐',
        private: 'PRIVATE 🔒',
        inbox: 'INBOX 📥',
        groups: 'GROUPS 👥'
      }[settings.workMode] || 'PUBLIC 🌐';

      const presenceBadge = {
        composing: 'TYPING ✍️',
        recording: 'RECORDING 🎙️',
        off: 'OFF 🔴'
      }[settings.autoPresence] || 'OFF 🔴';

      return await reply(
        `✅ *[+${botNumber}]* Settings යාවත්කාලීන විය!\n\n` +
        `• Work Mode     : *${modeBadge}*\n` +
        `• Auto Status   : *${settings.autoStatusSeen ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• Status React  : *${settings.statusReact ? 'ON 🟢' : 'OFF 🔴'} (${settings.statusReactEmoji || '💐'})*\n` +
        `• Fake Action   : *${presenceBadge}*`
      );
    }

    // DISPLAY SETTINGS MENU
    const stateBadge = (val) => (val !== false ? '🟢 ON' : '🔴 OFF');
    const modeBadge = {
      public: 'PUBLIC 🌐',
      private: 'PRIVATE 🔒',
      inbox: 'INBOX 📥',
      groups: 'GROUPS 👥'
    }[settings.workMode] || 'PUBLIC 🌐';

    const presenceBadge = {
      composing: 'TYPING ✍️',
      recording: 'RECORDING 🎙️',
      off: 'OFF 🔴'
    }[settings.autoPresence] || 'OFF 🔴';

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
├─◈ *2. AUTO STATUS SEEN* ⤿ [ ${stateBadge(settings.autoStatusSeen)} ]
│  ├ 2.1 Status Seen On
│  └ 2.2 Status Seen Off
│
├─◈ *3. STATUS REACTION* ⤿ [ ${stateBadge(settings.statusReact)} ]
│  ├ 3.1 React On
│  └ 3.2 React Off
│
├─◈ *4. STATUS EMOJI* ⤿ [ ${settings.statusReactEmoji || '💐'} ]
│  └ ✦ Type: .set 4 <emoji>
│
├─◈ *5. FAKE ACTION* ⤿ [ ${presenceBadge} ]
│  ├ 5.1 Fake Typing ✍️
│  ├ 5.2 Fake Recording 🎙️
│  └ 5.3 Turn Off 🔴
│
├─◈ *6. CHANGE PIN* ⤿ [ ${settings.securityPin || '1234'} ]
│  └ ✦ Type: .set 6 <new_pin>  (හෝ .set pin <pin>)
│
╰────────────────────────────────╯
💡 *පාලනය කිරීමට:*
• අදාළ Option එක Type කරන්න (උදා: *.set 2.1* හෝ *.set 1.2*)
• නැතහොත් මෙම පණිවිඩයට අංකය පමණක් Reply කරන්න (උදා: *1.2*)

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

    try {
      const logo = await getBotLogo();
      if (logo) {
        await sock.sendMessage(targetChat, {
          image: logo,
          caption: menu,
          mimetype: 'image/jpeg'
        }, { quoted: msg });
        return;
      }
    } catch (err) {
      console.error("Settings Menu Image dispatch failed:", err.message);
    }

    // Image failure එකකදී fallback text message එකක් යැවීම
    await reply(menu);
  }
};

