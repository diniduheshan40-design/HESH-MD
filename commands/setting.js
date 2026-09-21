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

// Safe Mongo Model Lookup Helper
function getModel() {
  try {
    if (mongoose.connection.readyState !== 1) return null;
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

  async execute(sock, msg, args = [], chatJid, safeReply, options = {}) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // ⚡ Channel Context Info
    const channelContext = global.channelContext?.contextInfo || {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: '120363421906774107@newsletter',
        newsletterName: '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨',
        serverMessageId: 1
      }
    };

    const quotedCaption = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage?.caption || 
                          msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || 
                          msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || '';

    const isSettingsReply = quotedCaption.includes("SYSTEM SETTINGS") || 
                            quotedCaption.includes("WORK MODE") ||
                            quotedCaption.includes("FAKE ACTION") ||
                            quotedCaption.includes("AI AUTO CHAT") ||
                            quotedCaption.includes("ANTI-DELETE");

    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    const isExplicitCommand = /^[./!#]?(settings|setting|set|config)/i.test(rawText);

    const hasArgsPassed = Array.isArray(args) && args.length > 0;
    if (!isExplicitCommand && !isSettingsReply && !hasArgsPassed) {
      return;
    }

    const rawBotId = sock.user?.id || sock.user?.jid || '';
    const botNumber = rawBotId.split(':')[0].split('@')[0].replace(/\D/g, '') || 'default';
    const senderNumber = (msg.key.participant || targetChat || '').split(':')[0].split('@')[0].replace(/\D/g, '');

    const isOwner = Boolean(
      options.isOwner || 
      msg.key.fromMe || 
      (Array.isArray(global.owner) && global.owner.includes(senderNumber)) ||
      senderNumber === botNumber
    );

    const reply = async (content) => {
      try {
        if (typeof safeReply === 'function') return await safeReply(content);
        const payload = typeof content === 'string' ? { text: content } : { ...content };
        payload.contextInfo = {
          ...(payload.contextInfo || {}),
          ...channelContext
        };
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
      autoChatRead: false,
      aiChatEnabled: false,
      antiDeleteEnabled: true,
      antiDeleteType: 'all',
      antiDeleteDest: 'me',
      securityPin: '1234'
    };

    let settings = { ...defaultValues };

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

    // Input Extraction
    let input = "";
    if (Array.isArray(args) && args.length > 0) {
      input = args.join(' ').trim().toLowerCase();
    } else if (isSettingsReply) {
      input = rawText.toLowerCase();
    }

    let isUpdated = false;

    // 1. WORK MODE
    if (input === '1.1' || input === 'private') { settings.workMode = 'private'; isUpdated = true; }
    else if (input === '1.2' || input === 'public') { settings.workMode = 'public'; isUpdated = true; }
    else if (input === '1.3' || input === 'inbox') { settings.workMode = 'inbox'; isUpdated = true; }
    else if (input === '1.4' || input === 'groups' || input === 'group') { settings.workMode = 'groups'; isUpdated = true; }

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

    // 7. AUTO CHAT READ (BLUE TICK) ON/OFF
    else if (input === '7.1') { settings.autoChatRead = true; isUpdated = true; }
    else if (input === '7.2') { settings.autoChatRead = false; isUpdated = true; }

    // 8. AI AUTO CHAT ON/OFF
    else if (input === '8.1' || input === 'aichat on') { settings.aiChatEnabled = true; isUpdated = true; }
    else if (input === '8.2' || input === 'aichat off') { settings.aiChatEnabled = false; isUpdated = true; }

    // 🛡️ 9. ANTI-DELETE STATUS (ON / OFF)
    else if (input === '9.1' || input === 'antidel on') { settings.antiDeleteEnabled = true; isUpdated = true; }
    else if (input === '9.2' || input === 'antidel off') { settings.antiDeleteEnabled = false; isUpdated = true; }

    // 🛡️ 10. ANTI-DELETE SCOPE (INBOX / GROUP / ALL)
    else if (input === '10.1' || input === 'antidel inbox') { settings.antiDeleteType = 'inbox'; isUpdated = true; }
    else if (input === '10.2' || input === 'antidel group') { settings.antiDeleteType = 'group'; isUpdated = true; }
    else if (input === '10.3' || input === 'antidel all') { settings.antiDeleteType = 'all'; isUpdated = true; }

    // 🛡️ 11. ANTI-DELETE DESTINATION (ME / FROM)
    else if (input === '11.1' || input === 'antidel to me') { settings.antiDeleteDest = 'me'; isUpdated = true; }
    else if (input === '11.2' || input === 'antidel to from') { settings.antiDeleteDest = 'from'; isUpdated = true; }

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

      // Flush memory cache in index.js
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

      const antiDelDestBadge = settings.antiDeleteDest === 'from' ? 'SAME CHAT 💬' : 'BOT OWNER INBOX 👤';

      return await reply(
        `✅ *[+${botNumber}]* Settings යාවත්කාලීන විය!\n\n` +
        `• Work Mode       : *${modeBadge}*\n` +
        `• Auto Status     : *${settings.autoStatusSeen ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• Status React    : *${settings.statusReact ? 'ON 🟢' : 'OFF 🔴'} (${settings.statusReactEmoji || '💐'})*\n` +
        `• Fake Action     : *${presenceBadge}*\n` +
        `• Auto Chat Seen  : *${settings.autoChatRead ? 'ON 🟢 (Blue Tick)' : 'OFF 🔴 (No Blue Tick)'}*\n` +
        `• AI Auto Chat    : *${settings.aiChatEnabled ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• Anti-Delete     : *${settings.antiDeleteEnabled ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• Anti-Del Scope  : *${(settings.antiDeleteType || 'all').toUpperCase()}*\n` +
        `• Anti-Del Target : *${antiDelDestBadge}*`
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

    const antiDelDestBadge = settings.antiDeleteDest === 'from' ? 'SAME CHAT' : 'BOT INBOX (ME)';

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
├─◈ *7. AUTO MGS SEEN* ⤿ [ ${stateBadge(settings.autoChatRead)} ]
│  ├ 7.1 Auto Seen On (Blue Tick)
│  └ 7.2 Auto Seen Off (Default)
│
├─◈ *8. AI AUTO CHAT* ⤿ [ ${stateBadge(settings.aiChatEnabled)} ]
│  ├ 8.1 AI Chat On 🤖
│  └ 8.2 AI Chat Off 🛑
│
├─◈ *9. ANTI-DELETE STATUS* ⤿ [ ${stateBadge(settings.antiDeleteEnabled)} ]
│  ├ 9.1 Anti-Delete On 🛡️
│  └ 9.2 Anti-Delete Off 🛑
│
├─◈ *10. ANTI-DELETE SCOPE* ⤿ [ ${(settings.antiDeleteType || 'all').toUpperCase()} ]
│  ├ 10.1 Inbox Only 📥
│  ├ 10.2 Group Only 👥
│  └ 10.3 All Chats 🌐
│
├─◈ *11. ANTI-DELETE TARGET* ⤿ [ ${antiDelDestBadge} ]
│  ├ 11.1 Send To Me (Owner Chat) 👤
│  └ 11.2 Send To Chat (Where Deleted) 💬
│
╰────────────────────────────────╯
💡 *පාලනය කිරීමට:*
• අදාළ Option එක Type කරන්න (උදා: *.set 9.1*, *.set 10.2*, *.set 11.1*)
• නැතහොත් මෙම පණිවිඩයට අංකය පමණක් Reply කරන්න (උදා: *9.1*)

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

    try {
      const logo = await getBotLogo();
      if (logo) {
        await sock.sendMessage(targetChat, {
          image: logo,
          caption: menu,
          mimetype: 'image/jpeg',
          contextInfo: channelContext
        }, { quoted: msg });
        return;
      }
    } catch (err) {
      console.error("Settings Menu Image dispatch failed:", err.message);
    }

    await sock.sendMessage(targetChat, { 
      text: menu,
      contextInfo: channelContext
    }, { quoted: msg }).catch(() => {});
  }
};

