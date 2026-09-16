const mongoose = require('mongoose');

// 🟢 Per-Bot MongoDB Schema
const SettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  workMode: { type: String, default: 'public' },
  autoAiInbox: { type: Boolean, default: true },
  autoStatusSeen: { type: Boolean, default: true },
  statusReact: { type: Boolean, default: true },
  statusReactEmoji: { type: String, default: '💐' },
  ownerReact: { type: Boolean, default: true },
  ownerReactEmoji: { type: String, default: '👑' },
  securityPin: { type: String, default: '1234' }
});

const SettingsModel = mongoose.models.BotSettings || mongoose.model('BotSettings', SettingsSchema);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 🟢 Visual Progress Bar Animation
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
      await sleep(150);
      await sock.sendMessage(chatJid, { text: loadingFrames[i], edit: initialMsg.key }).catch(() => {});
    }

    await sleep(150);
    await sock.sendMessage(chatJid, { text: finalContent, edit: initialMsg.key }).catch(async () => {
      await sock.sendMessage(chatJid, { text: finalContent }, { quoted: quotedMsg });
    });
  } catch (err) {
    await sock.sendMessage(chatJid, { text: finalContent }, { quoted: quotedMsg });
  }
}

module.exports = {
  name: 'settings',
  alias: ['setting', 'set', 'config'],
  description: 'Manage individual bot settings',
  async execute(sock, msg, args, chatJid, safeReply, { isOwner }) {
    if (!isOwner) {
      return await safeReply('⛔ *Access Denied!* Only Owner can modify settings.');
    }

    const botNumber = (sock.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || 'default';
    
    // DB Settings Load / Create
    let settings = await SettingsModel.findById(botNumber);
    if (!settings) {
      settings = await SettingsModel.create({ _id: botNumber });
    }

    let input = (args[0] || '').trim().toLowerCase();
    if (!input) {
      const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      input = rawText.trim().toLowerCase();
    }

    // 🟢 1. WORK MODE
    if (input === '1.1') {
      settings.workMode = 'private';
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `✅ *[+${botNumber}]* Mode set to: *PRIVATE 🔒*`);
    }
    if (input === '1.2') {
      settings.workMode = 'public';
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `✅ *[+${botNumber}]* Mode set to: *PUBLIC 🌐*`);
    }
    if (input === '1.3') {
      settings.workMode = 'inbox';
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `✅ *[+${botNumber}]* Mode set to: *INBOX ONLY 📥*`);
    }
    if (input === '1.4') {
      settings.workMode = 'groups';
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `✅ *[+${botNumber}]* Mode set to: *GROUPS ONLY 👥*`);
    }

    // 🟢 2. AUTO AI INBOX
    if (input === '2.1') {
      settings.autoAiInbox = true;
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `🤖 *[+${botNumber}]* Auto AI: *ENABLED 🟢*`);
    }
    if (input === '2.2') {
      settings.autoAiInbox = false;
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `🤖 *[+${botNumber}]* Auto AI: *DISABLED 🔴*`);
    }

    // 🟢 3. AUTO STATUS SEEN
    if (input === '3.1') {
      settings.autoStatusSeen = true;
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `👁️ *[+${botNumber}]* Status Seen: *ENABLED 🟢*`);
    }
    if (input === '3.2') {
      settings.autoStatusSeen = false;
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `👁️ *[+${botNumber}]* Status Seen: *DISABLED 🔴*`);
    }

    // 🟢 4. STATUS REACT
    if (input === '4.1') {
      settings.statusReact = true;
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `💐 *[+${botNumber}]* Status React: *ENABLED 🟢*`);
    }
    if (input === '4.2') {
      settings.statusReact = false;
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `💐 *[+${botNumber}]* Status React: *DISABLED 🔴*`);
    }

    // 🟢 5. OWNER REACT
    if (input === '5.1') {
      settings.ownerReact = true;
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `👑 *[+${botNumber}]* Owner React: *ENABLED 🟢*`);
    }
    if (input === '5.2') {
      settings.ownerReact = false;
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `👑 *[+${botNumber}]* Owner React: *DISABLED 🔴*`);
    }

    // 🟢 6. CHANGE EMOJI (.set 6 🔥)
    if (input.startsWith('6')) {
      const parts = args.join(' ').split(/ +/);
      const emoji = parts[1];
      if (!emoji) return await safeReply('⚠️ කරුණාකර Emoji එකක් ලබාදෙන්න! (උදා: `.set 6 🔥`)');
      settings.ownerReactEmoji = emoji;
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `🎨 *[+${botNumber}]* New Owner Emoji: *${emoji}*`);
    }

    // 🟢 7. CHANGE PIN (.set pin 5566)
    if (input.startsWith('pin')) {
      const parts = args.join(' ').split(/ +/);
      const newPin = parts[1];
      if (!newPin || newPin.length < 4) return await safeReply('⚠️ අවම අංක 4ක PIN එකක් දෙන්න! (උදා: `.set pin 7788`)');
      settings.securityPin = newPin;
      await settings.save();
      return await applyWithLoader(sock, chatJid, msg, `🔐 *[+${botNumber}]* PIN Updated to: *${newPin}*`);
    }

    // 🟢 PREMIUM CYBER-AESTHETIC MENU CARD
    const stateBadge = (val) => (val !== false ? '🟢 ON' : '🔴 OFF');
    const modeBadge = {
      public: 'PUBLIC 🌐',
      private: 'PRIVATE 🔒',
      inbox: 'INBOX 📥',
      groups: 'GROUPS 👥'
    }[settings.workMode || 'public'] || 'PUBLIC 🌐';

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
├─◈ *6. OWNER EMOJI* ⤿ [ ${settings.ownerReactEmoji || '👑'} ]
│  └ ✦ Type: .set 6 <emoji>
│
├─◈ *7. CHANGE PIN* ⤿ [ ${settings.securityPin || '1234'} ]
│  └ ✦ Type: .set pin <new_pin>
│
╰────────────────────────────────╯
💡 *පාලනය කිරීමට:*
• අදාළ Option අංකය කෙලින්ම Reply කරන්න (උදා: *1.1* හෝ *2.1*)

> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

    const bannerImg = 'https://files.catbox.moe/a58add.jpeg';

    try {
      return await sock.sendMessage(chatJid, {
        image: { url: bannerImg },
        caption: menu
      }, { quoted: msg });
    } catch (err) {
      return await safeReply(menu);
    }
  }
};

