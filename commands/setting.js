const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DEFAULT_BANNER = 'https://files.catbox.moe/a58add.jpeg';

// Per-Bot Database Schema
const SettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  workMode: { type: String, default: 'public' },
  autoAiInbox: { type: Boolean, default: true },
  autoStatusSeen: { type: Boolean, default: true },
  statusReact: { type: Boolean, default: true },
  statusReactEmoji: { type: String, default: '💐' },
  ownerReact: { type: Boolean, default: true },
  ownerReactEmoji: { type: String, default: '👑' },
  botLogo: { type: String, default: DEFAULT_BANNER },
  autoPresence: { type: String, default: 'off' }, // 'off', 'typing', 'recording'
  securityPin: { type: String, default: '1234' },
  isFirstConnectDone: { type: Boolean, default: false }
});

const SettingsModel = mongoose.models.BotSettings || mongoose.model('BotSettings', SettingsSchema);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function applyWithLoader(sock, chatJid, quotedMsg, finalContent) {
  try {
    const loadingFrames = [
      "🔄 *Updating Bot Settings...*\n[■□□□□□□□□□] 10%",
      "🔄 *Saving into Cloud Database...*\n[■■■■□□□□□□] 40%",
      "🔄 *Applying to this Session...*\n[■■■■■■■□□□] 75%",
      "🔄 *Finalizing Setup...*\n[■■■■■■■■■■] 100%"
    ];

    let initialMsg = await sock.sendMessage(chatJid, { text: loadingFrames[0] }, { quoted: quotedMsg });

    for (let i = 1; i < loadingFrames.length; i++) {
      await sleep(100);
      await sock.sendMessage(chatJid, { text: loadingFrames[i], edit: initialMsg.key }).catch(() => {});
    }

    await sleep(100);
    await sock.sendMessage(chatJid, { text: finalContent, edit: initialMsg.key }).catch(async () => {
      await sock.sendMessage(chatJid, { text: finalContent }, { quoted: quotedMsg });
    });
  } catch (err) {
    await sock.sendMessage(chatJid, { text: finalContent }, { quoted: quotedMsg });
  }
}

async function getBannerForBot(botNum, settings) {
  const specificLogo = path.join(process.cwd(), `logo_${botNum}.jpg`);
  if (fs.existsSync(specificLogo)) {
    try {
      return fs.readFileSync(specificLogo);
    } catch (e) {}
  }

  if (settings && settings.botLogo) {
    if (settings.botLogo.startsWith('data:image')) {
      try {
        const base64Data = settings.botLogo.split(',')[1];
        return Buffer.from(base64Data, 'base64');
      } catch (e) {}
    }
    if (fs.existsSync(settings.botLogo)) {
      try {
        return fs.readFileSync(settings.botLogo);
      } catch (e) {}
    }
    if (settings.botLogo.startsWith('http')) {
      return { url: settings.botLogo };
    }
  }

  return { url: DEFAULT_BANNER };
}

module.exports = {
  name: 'settings',
  alias: ['setting', 'set', 'config'],
  description: 'Manage individual bot settings',
  async execute(sock, msg, args, chatJid, safeReply, { isOwner }) {
    if (!isOwner) {
      return await safeReply('⛔ *Access Denied!* Only Owner can modify settings.');
    }

    const botNumber = (sock.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    if (!botNumber) return await safeReply('⚠️ Bot Number හඳුනාගත නොහැකි විය.');

    let settings = await SettingsModel.findById(botNumber);
    if (!settings) {
      settings = await SettingsModel.create({ _id: botNumber });
    }

    // Input Resolution
    const rawMsg = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || 
                   '';
                   
    let fullInput = (args && args.length > 0 ? args.join(' ') : rawMsg).trim().toLowerCase();

    // Command prefix ඉවත් කිරීම (උදා: '.set 1.1' -> '1.1')
    fullInput = fullInput.replace(/^[./!#]?(settings|setting|set|config)\s*/i, '').trim();

    let isUpdated = false;

    // 1. WORK MODE
    if (fullInput === '1.1') { settings.workMode = 'private'; isUpdated = true; }
    else if (fullInput === '1.2') { settings.workMode = 'public'; isUpdated = true; }
    else if (fullInput === '1.3') { settings.workMode = 'inbox'; isUpdated = true; }
    else if (fullInput === '1.4') { settings.workMode = 'groups'; isUpdated = true; }

    // 2. AUTO AI INBOX
    else if (fullInput === '2.1') { settings.autoAiInbox = true; isUpdated = true; }
    else if (fullInput === '2.2') { settings.autoAiInbox = false; isUpdated = true; }

    // 3. AUTO STATUS SEEN
    else if (fullInput === '3.1') { settings.autoStatusSeen = true; isUpdated = true; }
    else if (fullInput === '3.2') { settings.autoStatusSeen = false; isUpdated = true; }

    // 4. STATUS REACT
    else if (fullInput === '4.1') { settings.statusReact = true; isUpdated = true; }
    else if (fullInput === '4.2') { settings.statusReact = false; isUpdated = true; }

    // 5. OWNER REACT
    else if (fullInput === '5.1') { settings.ownerReact = true; isUpdated = true; }
    else if (fullInput === '5.2') { settings.ownerReact = false; isUpdated = true; }

    // 6. FAKE ACTION (TYPING / RECORDING / OFF)
    else if (fullInput === '6.1') { settings.autoPresence = 'typing'; isUpdated = true; }
    else if (fullInput === '6.2') { settings.autoPresence = 'recording'; isUpdated = true; }
    else if (fullInput === '6.3') { settings.autoPresence = 'off'; isUpdated = true; }

    // 7. CHANGE EMOJI (.set 7 🔥 or reply '7 🔥')
    else if (fullInput.startsWith('7')) {
      const parts = fullInput.split(/ +/);
      const emoji = parts[1];
      if (!emoji) return await safeReply('⚠️ කරුණාකර Emoji එකක් ලබාදෙන්න! (උදා: `7 🔥` හෝ `.set 7 🔥`)');
      settings.ownerReactEmoji = emoji;
      isUpdated = true;
    }

    // 8. CHANGE PIN (.set pin 5566 or reply 'pin 5566')
    else if (fullInput.startsWith('pin')) {
      const parts = fullInput.split(/ +/);
      const newPin = parts[1];
      if (!newPin || newPin.length < 4) return await safeReply('⚠️ අවම අංක 4ක PIN එකක් දෙන්න! (උදා: `pin 7788`)');
      settings.securityPin = newPin;
      isUpdated = true;
    }

    // Database Update & Cache Eviction
    if (isUpdated) {
      await settings.save();
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
        typing: 'TYPING ✍️',
        recording: 'RECORDING 🎙️',
        off: 'OFF 🔴'
      }[settings.autoPresence || 'off'] || 'OFF 🔴';

      return await applyWithLoader(
        sock, 
        chatJid, 
        msg, 
        `✅ *[+${botNumber}]* Settings යාවත්කාලීන විය!\n• Work Mode: *${modeBadge}*\n• Fake Action: *${presenceBadge}*\n• AI Inbox: *${settings.autoAiInbox ? 'ON 🟢' : 'OFF 🔴'}*`
      );
    }

    // SETTINGS MENU DISPLAY
    const stateBadge = (val) => (val !== false ? '🟢 ON' : '🔴 OFF');
    const modeBadge = {
      public: 'PUBLIC 🌐',
      private: 'PRIVATE 🔒',
      inbox: 'INBOX 📥',
      groups: 'GROUPS 👥'
    }[settings.workMode || 'public'] || 'PUBLIC 🌐';

    const presenceBadge = {
      typing: 'TYPING ✍️',
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
├─◈ *5. OWNER REACT* ⤿ [ ${stateBadge(settings.ownerReact)} ]
│  ├ 5.1 Owner React On
│  └ 5.2 Owner React Off
│
├─◈ *6. FAKE ACTION* ⤿ [ ${presenceBadge} ]
│  ├ 6.1 Fake Typing ✍️
│  ├ 6.2 Fake Recording 🎙️
│  └ 6.3 Turn Off 🔴
│
├─◈ *7. OWNER EMOJI* ⤿ [ ${settings.ownerReactEmoji || '👑'} ]
│  └ ✦ Type: .set 7 <emoji>
│
├─◈ *8. CHANGE PIN* ⤿ [ ${settings.securityPin || '1234'} ]
│  └ ✦ Type: .set pin <new_pin>
│
╰────────────────────────────────╯
💡 *පාලනය කිරීමට:*
• අදාළ Option අංකය කෙලින්ම Reply කරන්න (උදා: *6.1* හෝ *6.2*)

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

    try {
      const bannerPayload = await getBannerForBot(botNumber, settings);
      return await sock.sendMessage(chatJid, {
        image: bannerPayload,
        caption: menu
      }, { quoted: msg });
    } catch (err) {
      return await safeReply(menu);
    }
  }
};

