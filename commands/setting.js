const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');

const memSettingsCache = new Map();

// ⚡ Safe Logo Fetcher with Fallback
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
  } catch (e) {}

  try {
    const fallbackUrl = 'https://raw.githubusercontent.com/diniduheshan40-design/HESH-MD/main/logo.jpg';
    const res = await axios.get(fallbackUrl, { responseType: 'arraybuffer', timeout: 5000 });
    cachedLogo = Buffer.from(res.data, 'binary');
    return cachedLogo;
  } catch (e) {
    return null;
  }
}

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
                            quotedCaption.includes("PRESENCE STATUS") ||
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
        payload.contextInfo = { ...(payload.contextInfo || {}), ...channelContext };
        return await sock.sendMessage(targetChat, payload, { quoted: msg });
      } catch (err) {}
    };

    if (!isOwner) {
      return await reply('⛔ *Access Denied!* Only Bot Owner can modify settings.');
    }

    sock.sendMessage(targetChat, { react: { text: "⚙️", key: msg.key } }).catch(() => {});

    const defaultValues = {
      workMode: 'public',
      autoStatusSeen: true,
      statusReact: true,
      statusReactEmoji: '💚',
      autoPresence: 'off',
      alwaysOnline: 'off',
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
      } catch (e) {}
      memSettingsCache.set(botNumber, settings);
    }

    let input = "";
    if (Array.isArray(args) && args.length > 0) {
      input = args.join(' ').trim().toLowerCase();
    } else if (isSettingsReply) {
      input = rawText.toLowerCase().trim();
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

    // 3. STATUS REACTION ON/OFF
    else if (input === '3.1') { settings.statusReact = true; isUpdated = true; }
    else if (input === '3.2') { settings.statusReact = false; isUpdated = true; }

    // 4. STATUS REACT EMOJI (💚 GREEN HEART / RANDOM / CUSTOM)
    else if (input === '4.1' || input === 'react green') { 
      settings.statusReact = true;
      settings.statusReactEmoji = '💚'; 
      isUpdated = true; 
    }
    else if (input === '4.2' || input === 'react random') { 
      settings.statusReact = true;
      settings.statusReactEmoji = 'random'; 
      isUpdated = true; 
    }
    else if (input.startsWith('4.3 ') || input.startsWith('4 ')) {
      const parts = input.split(' ');
      if (parts[1]) {
        settings.statusReact = true;
        settings.statusReactEmoji = parts[1].trim();
        isUpdated = true;
      } else {
        return await reply('⚠️ කරුණාකර Emoji එකක් ලබාදෙන්න! (උදා: `.set 4.3 🔥` හෝ `.set 4 🌸`)');
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
        return await reply('⚠️ අවම අංක 4ක PIN එකක් ලබාදෙන්න! (උදා: `.set 6 7788`)');
      }
    }

    // 7. AUTO CHAT READ (BLUE TICK)
    else if (input === '7.1') { settings.autoChatRead = true; isUpdated = true; }
    else if (input === '7.2') { settings.autoChatRead = false; isUpdated = true; }

    // 8. AI AUTO CHAT
    else if (input === '8.1') { settings.aiChatEnabled = true; isUpdated = true; }
    else if (input === '8.2') { settings.aiChatEnabled = false; isUpdated = true; }

    // 9. ANTI-DELETE ON/OFF
    else if (input === '9.1') { settings.antiDeleteEnabled = true; isUpdated = true; }
    else if (input === '9.2') { settings.antiDeleteEnabled = false; isUpdated = true; }

    // 10. ANTI-DELETE SCOPE
    else if (input === '10.1') { settings.antiDeleteType = 'inbox'; isUpdated = true; }
    else if (input === '10.2') { settings.antiDeleteType = 'group'; isUpdated = true; }
    else if (input === '10.3') { settings.antiDeleteType = 'all'; isUpdated = true; }

    // 11. ANTI-DELETE DESTINATION (ME / FROM)
    else if (input === '11.1' || input === 'antisend me' || input === 'antidel me') { 
      settings.antiDeleteDest = 'me'; 
      isUpdated = true; 
    }
    else if (input === '11.2' || input === 'antisend from' || input === 'antidel from') { 
      settings.antiDeleteDest = 'from'; 
      isUpdated = true; 
    }

    // 12. ALWAYS ONLINE / OFFLINE
    else if (input === '12.1') { 
      settings.alwaysOnline = 'on'; 
      isUpdated = true; 
      sock.sendPresenceUpdate('available').catch(() => {});
    }
    else if (input === '12.2') { 
      settings.alwaysOnline = 'offline'; 
      isUpdated = true; 
      sock.sendPresenceUpdate('unavailable').catch(() => {});
    }
    else if (input === '12.3') { 
      settings.alwaysOnline = 'off'; 
      isUpdated = true; 
      sock.sendPresenceUpdate('unavailable').catch(() => {});
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
      } catch (e) {}

      if (typeof global.clearSettingsCache === 'function') {
        global.clearSettingsCache(botNumber);
      }

      const reactEmojiDisplay = settings.statusReactEmoji === 'random' ? 'RANDOM EMOJIS 🔀' : settings.statusReactEmoji;
      const antiSendDisplay = settings.antiDeleteDest === 'from' ? 'CHAT ITSELF (FROM) 💬' : 'MY INBOX (ME) 📥';

      return await reply(
        `✅ *[+${botNumber}]* Settings යාවත්කාලීන විය!\n\n` +
        `• Status Seen     : *${settings.autoStatusSeen ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• Status React    : *${settings.statusReact ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• React Style     : *${reactEmojiDisplay}*\n` +
        `• Anti-Delete     : *${settings.antiDeleteEnabled ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• Anti-Send Dest  : *${antiSendDisplay}*\n` +
        `• Always Online   : *${settings.alwaysOnline.toUpperCase()}*`
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

    const currentReactDisplay = settings.statusReactEmoji === 'random' ? 'RANDOM 🔀' : (settings.statusReactEmoji || '💚');
    const antiSendDestDisplay = settings.antiDeleteDest === 'from' ? 'FROM (Chat Itself) 💬' : 'ME (My Inbox) 📥';

    const menu = `╭─── ⚡ *HESHAN-MD SYSTEM SETTINGS* ⚡ ───╮
│
├ 🤖 *Target Session :* +${botNumber}
├ 🛡️ *Master Access  :* Verified
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
│  ├ 3.1 React On 🟢
│  └ 3.2 React Off 🔴
│
├─◈ *4. STATUS REACT EMOJI* ⤿ [ ${currentReactDisplay} ]
│  ├ 4.1 💚 Green Heart Only
│  ├ 4.2 🔀 Random Emojis Mode
│  └ 4.3 <emoji> (උදා: .set 4.3 🔥)
│
├─◈ *5. FAKE ACTION* ⤿ [ ${(settings.autoPresence || 'off').toUpperCase()} ]
│  ├ 5.1 Fake Typing ✍️
│  ├ 5.2 Fake Recording 🎙️
│  └ 5.3 Turn Off 🔴
│
├─◈ *6. CHANGE PIN* ⤿ [ ${settings.securityPin || '1234'} ]
│  └ ✦ Type: .set 6 <new_pin>
│
├─◈ *7. AUTO MSG SEEN* ⤿ [ ${stateBadge(settings.autoChatRead)} ]
│  ├ 7.1 Auto Seen On (Blue Tick)
│  └ 7.2 Auto Seen Off
│
├─◈ *8. AI AUTO CHAT* ⤿ [ ${stateBadge(settings.aiChatEnabled)} ]
│  ├ 8.1 AI Chat On 🤖
│  └ 8.2 AI Chat Off 🛑
│
├─◈ *9. ANTI-DELETE* ⤿ [ ${stateBadge(settings.antiDeleteEnabled)} ]
│  ├ 9.1 Anti-Delete On 🛡️
│  └ 9.2 Anti-Delete Off 🛑
│
├─◈ *10. ANTI-DELETE SCOPE* ⤿ [ ${(settings.antiDeleteType || 'all').toUpperCase()} ]
│  ├ 10.1 Inbox Only
│  ├ 10.2 Groups Only
│  └ 10.3 All Chats
│
├─◈ *11. ANTI-DELETE SEND TO* ⤿ [ ${antiSendDestDisplay} ]
│  ├ 11.1 Send To Me (My Inbox) 📥
│  └ 11.2 Send To From (Same Chat) 💬
│
├─◈ *12. ALWAYS ONLINE* ⤿ [ ${settings.alwaysOnline.toUpperCase()} ]
│  ├ 12.1 Always Online 🟢
│  ├ 12.2 Always Offline ⚪
│  └ 12.3 Normal Mode 🔴
│
╰────────────────────────────────╯
💡 *පාලනය කිරීමට:*
• Settings පණිවිඩයට අදාළ අංකය Reply කරන්න (උදා: *11.1* හෝ *11.2*)
• නැතහොත් command එක run කරන්න (උදා: *.set 11.1*, *.set antisend from*)

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
    } catch (err) {}

    await sock.sendMessage(targetChat, { 
      text: menu,
      contextInfo: channelContext
    }, { quoted: msg }).catch(() => {});
  }
};
