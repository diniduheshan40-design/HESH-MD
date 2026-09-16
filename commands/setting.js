const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../settings.json');

// Default Settings
const defaultSettings = {
  workMode: 'public', // 'public', 'private', 'inbox', 'groups'
  autoAiInbox: true,
  autoStatusSeen: true,
  statusReact: true,
  statusReactEmoji: '💐',
  ownerReact: true,
  ownerReactEmoji: '👑'
};

function getSettings() {
  try {
    if (!fs.existsSync(settingsPath)) {
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return { ...defaultSettings, ...data };
  } catch (e) {
    return defaultSettings;
  }
}

function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  global.botSettings = settings;
  global.autoAiInbox = settings.autoAiInbox;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 🟢 Animated Progress Loader & Editor
async function applyWithLoader(sock, chatJid, quotedMsg, finalContent) {
  try {
    const loadingFrames = [
      "🔄 *Updating Configuration...*\n[■□□□□□□□□□] 10%",
      "🔄 *Applying Core Changes...*\n[■■■■□□□□□□] 40%",
      "🔄 *Saving into Database...*\n[■■■■■■■□□□] 75%",
      "🔄 *Finalizing Setup...*\n[■■■■■■■■■■] 100%"
    ];

    // මුලින්ම loading message එක යවනවා
    let initialMsg = await sock.sendMessage(chatJid, { text: loadingFrames[0] }, { quoted: quotedMsg });

    // Loading stages animation
    for (let i = 1; i < loadingFrames.length; i++) {
      await sleep(350);
      await sock.sendMessage(chatJid, {
        text: loadingFrames[i],
        edit: initialMsg.key
      });
    }

    await sleep(400);

    // අවසානයේ Setting change වුණු ලස්සන final message එකට edit වෙනවා
    await sock.sendMessage(chatJid, {
      text: finalContent,
      edit: initialMsg.key
    });
  } catch (err) {
    // Message edit support නැති උනොත් කෙලින්ම final message එක යවනවා
    await sock.sendMessage(chatJid, { text: finalContent }, { quoted: quotedMsg });
  }
}

module.exports = {
  name: 'settings',
  alias: ['setting', 'set', 'config'],
  description: 'Manage bot settings via modern interactive menu with animated loader',
  async execute(sock, msg, args, chatJid, safeReply, { isOwner }) {
    if (!isOwner) {
      return await safeReply('⛔ *Access Denied!* Only the Master Owner can access settings.');
    }

    let settings = getSettings();

    // Context reply detection
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || '';
    const isReplyToMenu = quotedText.includes('SYSTEM CONFIG');

    let input = args.join(' ').trim();
    if (!input && isReplyToMenu) {
      const currentRaw = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      input = currentRaw.trim();
    }

    const parts = input.split(/ +/);
    const choice = parts[0]?.toLowerCase();

    // 🟢 1. Work Mode Selector
    if (choice === '1') {
      const sub = parts[1]?.toLowerCase();
      if (sub === 'public' || sub === 'private' || sub === 'inbox' || sub === 'groups') {
        settings.workMode = sub;
      } else {
        const modes = ['public', 'private', 'inbox', 'groups'];
        const nextIdx = (modes.indexOf(settings.workMode) + 1) % modes.length;
        settings.workMode = modes[nextIdx];
      }
      saveSettings(settings);

      const resText = `╔══════════════════════════════════╗\n║  ✅ *WORK MODE UPDATED*           \n╠══════════════════════════════════╣\n║  🌐 Mode set to: *${settings.workMode.toUpperCase()}*\n╚══════════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;
      return await applyWithLoader(sock, chatJid, msg, resText);
    }

    // 🟢 2. Auto AI Inbox
    if (choice === '2') {
      settings.autoAiInbox = !settings.autoAiInbox;
      saveSettings(settings);

      const resText = `╔══════════════════════════════════╗\n║  ✅ *AI INBOX CONFIG UPDATED*     \n╠══════════════════════════════════╣\n║  🤖 Status: *${settings.autoAiInbox ? 'ENABLED 🟢' : 'DISABLED 🔴'}*\n╚══════════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;
      return await applyWithLoader(sock, chatJid, msg, resText);
    }

    // 🟢 3. Auto Status Seen
    if (choice === '3') {
      settings.autoStatusSeen = !settings.autoStatusSeen;
      saveSettings(settings);

      const resText = `╔══════════════════════════════════╗\n║  ✅ *STATUS SEEN UPDATED*         \n╠══════════════════════════════════╣\n║  👁️ Status: *${settings.autoStatusSeen ? 'ENABLED 🟢' : 'DISABLED 🔴'}*\n╚══════════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;
      return await applyWithLoader(sock, chatJid, msg, resText);
    }

    // 🟢 4. Status Reaction
    if (choice === '4') {
      settings.statusReact = !settings.statusReact;
      saveSettings(settings);

      const resText = `╔══════════════════════════════════╗\n║  ✅ *STATUS REACT UPDATED*        \n╠══════════════════════════════════╣\n║  💐 Status: *${settings.statusReact ? 'ENABLED 🟢' : 'DISABLED 🔴'}*\n╚══════════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;
      return await applyWithLoader(sock, chatJid, msg, resText);
    }

    // 🟢 5. Owner React
    if (choice === '5') {
      settings.ownerReact = !settings.ownerReact;
      saveSettings(settings);

      const resText = `╔══════════════════════════════════╗\n║  ✅ *OWNER REACT UPDATED*         \n╠══════════════════════════════════╣\n║  👑 Status: *${settings.ownerReact ? 'ENABLED 🟢' : 'DISABLED 🔴'}*\n╚══════════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;
      return await applyWithLoader(sock, chatJid, msg, resText);
    }

    // 🟢 6. Owner Emoji Change
    if (choice === '6') {
      const emoji = parts[1] || args[1];
      if (!emoji) {
        return await safeReply('⚠️ කරුණාකර Emoji එකක් ඇතුළත් කරන්න!\n_උදා: `.set 6 ⚡` හෝ reply කර `6 ⚡`_');
      }
      settings.ownerReactEmoji = emoji;
      saveSettings(settings);

      const resText = `╔══════════════════════════════════╗\n║  ✅ *OWNER EMOJI UPDATED*         \n╠══════════════════════════════════╣\n║  🎨 New Emoji: *${emoji}*\n╚══════════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;
      return await applyWithLoader(sock, chatJid, msg, resText);
    }

    // 🟢 Control Panel Menu (Neon Box Style)
    const stateBadge = (val) => (val ? '🟢 ON ' : '🔴 OFF');
    const modeBadge = {
      public: '🌐 PUBLIC ',
      private: '🔒 PRIVATE',
      inbox: '📥 INBOX  ',
      groups: '👥 GROUPS '
    }[settings.workMode] || '🌐 PUBLIC ';

    const menu = `
╔══════════════════════════════════╗
║   ⚡ HESHAN-MD SYSTEM CONFIG ⚡   ║
╠══════════════════════════════════╣
║                                  ║
║  [1] 🌐 Mode       : [ ${modeBadge} ]  ║
║  [2] 🤖 Auto AI   : [ ${stateBadge(settings.autoAiInbox)} ]  ║
║  [3] 👁️  Seen WA   : [ ${stateBadge(settings.autoStatusSeen)} ]  ║
║  [4] 💐 React WA  : [ ${stateBadge(settings.statusReact)} ]  ║
║  [5] 👑 Own React : [ ${stateBadge(settings.ownerReact)} ]  ║
║  [6] 🎨 Own Emoji : [  ${settings.ownerReactEmoji || '👑'}  ]        ║
║                                  ║
╠══════════════════════════════════╣
║  🔢 පාලනය සඳහා ක්‍රම:             ║
║  • මේ මැසේජ් එකට අදාළ අංකය      ║
║    Reply කරන්න (උදා: 1 හෝ 2)     ║
║  • නැතහොත් .set 1, .set 6 🔥 ලෙස   ║
║    command එක සමඟ යවන්න          ║
╚══════════════════════════════════╝
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

    return await safeReply(menu);
  }
};

