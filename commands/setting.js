// commands/settings.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// In-memory cache to prevent database hammering & freeze
const memSettingsCache = new Map();

let cachedLogo = null;
function getBotLogo() {
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
    console.error("Logo error:", e.message);
  }
  return { url: 'https://raw.githubusercontent.com/diniduheshan40-design/HESH-MD/main/logo.jpg' };
}

module.exports = {
  name: 'settings',
  alias: ['setting', 'set', 'config'],
  category: 'owner',
  desc: 'Manage individual bot settings',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = chatJid || msg.key.remoteJid;
    const isOwner = options.isOwner || msg.key.fromMe;

    const reply = async (content) => {
      try {
        if (typeof safeReply === 'function') return await safeReply(content);
        return await sock.sendMessage(targetChat, typeof content === 'string' ? { text: content } : content, { quoted: msg });
      } catch (err) {
        console.error("Reply sending failed:", err.message);
      }
    };

    if (!isOwner) {
      return await reply('⛔ *Access Denied!* Only Bot Owner can modify settings.');
    }

    // Reaction without awaiting to keep it async non-blocking
    sock.sendMessage(targetChat, { react: { text: "⚙️", key: msg.key } }).catch(() => {});

    // Target bot number identification
    const botNumber = (sock.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
    if (!botNumber) return await reply('⚠️ Bot Number හඳුනාගත නොහැකි විය.');

    let settings = {
      workMode: 'public',
      autoAiInbox: true,
      autoStatusSeen: true,
      statusReact: true,
      autoPresence: 'off',
      securityPin: '1234',
      ownerReactEmoji: '👑'
    };

    // 1. Fast Cache Fetch (No DB lag)
    if (memSettingsCache.has(botNumber)) {
      settings = Object.assign(settings, memSettingsCache.get(botNumber));
    } else {
      try {
        if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
          const doc = await mongoose.connection.db.collection('botsettings').findOne({ _id: botNumber });
          if (doc) {
            settings = Object.assign(settings, doc);
            memSettingsCache.set(botNumber, settings);
          }
        }
      } catch (e) {
        console.error("Settings DB Fetch Error:", e.message);
      }
    }

    // Input parsing
    let input = (args && args.length > 0) ? args.join(' ').trim().toLowerCase() : "";
    if (!input) {
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
      const parts = input.split(' ');
      if (parts[1]) {
        settings.ownerReactEmoji = parts[1].trim();
        isUpdated = true;
      } else {
        return await reply('⚠️ කරුණාකර Emoji එකක් ලබාදෙන්න! (උදා: `.set 6 🔥`)');
      }
    }

    // 7. CHANGE PIN
    else if (input.startsWith('pin')) {
      const parts = input.split(' ');
      if (parts[1] && parts[1].length >= 4) {
        settings.securityPin = parts[1].trim();
        isUpdated = true;
      } else {
        return await reply('⚠️ අවම අංක 4ක PIN එකක් ලබාදෙන්න! (උදා: `.set pin 7788`)');
      }
    }

    // UPDATE EXECUTOR
    if (isUpdated) {
      memSettingsCache.set(botNumber, settings);

      // Async Non-blocking DB write
      if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
        mongoose.connection.db.collection('botsettings').updateOne(
          { _id: botNumber },
          { $set: settings },
          { upsert: true }
        ).catch(e => console.error("Settings save error:", e.message));
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
        `• Work Mode   : *${modeBadge}*\n` +
        `• Fake Action : *${presenceBadge}*\n` +
        `• AI Inbox    : *${settings.autoAiInbox ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• Status Seen : *${settings.autoStatusSeen ? 'ON 🟢' : 'OFF 🔴'}*`
      );
    }

    // DISPLAY MENU
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
• අදාළ Option එක Type කරන්න (උදා: *.set 3.1* හෝ *.set 1.2*)

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

    try {
      await sock.sendMessage(targetChat, {
        image: getBotLogo(),
        caption: menu,
        mimetype: 'image/jpeg'
      }, { quoted: msg });
    } catch (err) {
      await reply(menu);
    }
  }
};

