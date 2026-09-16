const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../settings.json');

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

async function applyWithLoader(sock, chatJid, quotedMsg, finalContent) {
  try {
    const loadingFrames = [
      "🔄 *Updating Configuration...*\n[■□□□□□□□□□] 10%",
      "🔄 *Applying Core Changes...*\n[■■■■□□□□□□] 40%",
      "🔄 *Saving into Database...*\n[■■■■■■■□□□] 75%",
      "🔄 *Finalizing Setup...*\n[■■■■■■■■■■] 100%"
    ];

    let initialMsg = await sock.sendMessage(chatJid, { text: loadingFrames[0] }, { quoted: quotedMsg });

    for (let i = 1; i < loadingFrames.length; i++) {
      await sleep(300);
      await sock.sendMessage(chatJid, {
        text: loadingFrames[i],
        edit: initialMsg.key
      });
    }

    await sleep(350);

    await sock.sendMessage(chatJid, {
      text: finalContent,
      edit: initialMsg.key
    });
  } catch (err) {
    await sock.sendMessage(chatJid, { text: finalContent }, { quoted: quotedMsg });
  }
}

module.exports = {
  name: 'settings',
  alias: ['setting', 'set', 'config'],
  description: 'Manage bot settings with sub-options and animated loader',
  async execute(sock, msg, args, chatJid, safeReply, { isOwner }) {
    if (!isOwner) {
      return await safeReply('⛔ *Access Denied!* Only Owner can modify settings.');
    }

    let settings = getSettings();

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || '';
    const isReplyToMenu = quotedText.includes('SYSTEM CONFIG');

    let input = args.join(' ').trim();
    if (!input && isReplyToMenu) {
      const currentRaw = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      input = currentRaw.trim();
    }

    const choice = input.toLowerCase();

    // 🟢 1. WORK MODE SUB-OPTIONS
    if (choice === '1.1') {
      settings.workMode = 'private';
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *WORK MODE UPDATED*       \n╠══════════════════════════════╣\n║  🌐 Mode set to: *PRIVATE 🔒* \n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '1.2') {
      settings.workMode = 'public';
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *WORK MODE UPDATED*       \n╠══════════════════════════════╣\n║  🌐 Mode set to: *PUBLIC 🌐*  \n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '1.3') {
      settings.workMode = 'inbox';
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *WORK MODE UPDATED*       \n╠══════════════════════════════╣\n║  🌐 Mode set to: *INBOX ONLY 📥*\n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '1.4') {
      settings.workMode = 'groups';
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *WORK MODE UPDATED*       \n╠══════════════════════════════╣\n║  🌐 Mode set to: *GROUPS ONLY 👥*\n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 2. AUTO AI SUB-OPTIONS
    if (choice === '2.1') {
      settings.autoAiInbox = true;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *AI INBOX UPDATED*        \n╠══════════════════════════════╣\n║  🤖 Auto AI: *ENABLED 🟢*     \n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '2.2') {
      settings.autoAiInbox = false;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *AI INBOX UPDATED*        \n╠══════════════════════════════╣\n║  🤖 Auto AI: *DISABLED 🔴*    \n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 3. AUTO STATUS SEEN SUB-OPTIONS
    if (choice === '3.1') {
      settings.autoStatusSeen = true;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *STATUS SEEN UPDATED*     \n╠══════════════════════════════╣\n║  👁️ Seen: *ENABLED 🟢*        \n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '3.2') {
      settings.autoStatusSeen = false;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *STATUS SEEN UPDATED*     \n╠══════════════════════════════╣\n║  👁️ Seen: *DISABLED 🔴*       \n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 4. STATUS REACT SUB-OPTIONS
    if (choice === '4.1') {
      settings.statusReact = true;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *STATUS REACT UPDATED*    \n╠══════════════════════════════╣\n║  💐 React: *ENABLED 🟢*       \n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '4.2') {
      settings.statusReact = false;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *STATUS REACT UPDATED*    \n╠══════════════════════════════╣\n║  💐 React: *DISABLED 🔴*      \n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 5. OWNER REACT SUB-OPTIONS
    if (choice === '5.1') {
      settings.ownerReact = true;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *OWNER REACT UPDATED*     \n╠══════════════════════════════╣\n║  👑 React: *ENABLED 🟢*       \n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '5.2') {
      settings.ownerReact = false;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *OWNER REACT UPDATED*     \n╠══════════════════════════════╣\n║  👑 React: *DISABLED 🔴*      \n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 6. OWNER EMOJI CHANGE (Ex: .set 6 🔥 or reply with 6 🔥)
    if (choice.startsWith('6')) {
      const parts = choice.split(/ +/);
      const emoji = parts[1];
      if (!emoji) {
        return await safeReply('⚠️ කරුණාකර Emoji එකක් ඇතුළත් කරන්න!\n_උදා: `.set 6 ⚡` හෝ reply කර `6 ⚡`_');
      }
      settings.ownerReactEmoji = emoji;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `╔══════════════════════════════╗\n║  ✅ *OWNER EMOJI UPDATED*     \n╠══════════════════════════════╣\n║  🎨 New Emoji: *${emoji}*      \n╚══════════════════════════════╝\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 Display Settings Menu with Sub-options
    const stateBadge = (val) => (val ? '🟢 ON' : '🔴 OFF');
    const modeBadge = {
      public: 'PUBLIC 🌐',
      private: 'PRIVATE 🔒',
      inbox: 'INBOX 📥',
      groups: 'GROUPS 👥'
    }[settings.workMode] || 'PUBLIC 🌐';

    const menu = `
╔══════════════════════════════════════╗
║      ⚡ HESHAN-MD SYSTEM CONFIG ⚡    ║
╠══════════════════════════════════════╣
║                                      ║
║  [1] 🌐 WORK MODE [ ${modeBadge} ]
║      ├ 1.1 Private                   ║
║      ├ 1.2 Public                    ║
║      ├ 1.3 Inbox Only                ║
║      └ 1.4 Group Only                ║
║                                      ║
║  [2] 🤖 AUTO AI INBOX [ ${stateBadge(settings.autoAiInbox)} ]
║      ├ 2.1 AI On                     ║
║      └ 2.2 AI Off                    ║
║                                      ║
║  [3] 👁️ AUTO STATUS SEEN [ ${stateBadge(settings.autoStatusSeen)} ]
║      ├ 3.1 Status Seen On            ║
║      └ 3.2 Status Seen Off           ║
║                                      ║
║  [4] 💐 STATUS REACT [ ${stateBadge(settings.statusReact)} ]
║      ├ 4.1 Status React On           ║
║      └ 4.2 Status React Off          ║
║                                      ║
║  [5] 👑 OWNER REACT [ ${stateBadge(settings.ownerReact)} ]
║      ├ 5.1 Owner React On            ║
║      └ 5.2 Owner React Off           ║
║                                      ║
║  [6] 🎨 OWNER EMOJI [  ${settings.ownerReactEmoji || '👑'}  ]
║      └ .set 6 <emoji>                ║
║                                      ║
╠══════════════════════════════════════╣
║  🔢 පාලනය සඳහා:                      ║
║  • මේ මැසේජ් එකට අදාළ අංකය Reply     ║
║    කරන්න (උදා: 1.1 හෝ 2.2)           ║
║  • නැතහොත් .set 1.2, .set 6 🔥 ලෙස   ║
║    command එක සමඟ යවන්න              ║
╚══════════════════════════════════════╝
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

    return await safeReply(menu);
  }
};

