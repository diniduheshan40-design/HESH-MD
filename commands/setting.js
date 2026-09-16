let getBotSettings, updateBotSettings;
try {
  const mod = require('../BotSettings');
  getBotSettings = mod.getBotSettings;
  updateBotSettings = mod.updateBotSettings;
} catch (e) {
  try {
    const mod = require('../../BotSettings');
    getBotSettings = mod.getBotSettings;
    updateBotSettings = mod.updateBotSettings;
  } catch (err) {
    console.error('Failed to load BotSettings in settings.js:', err.message);
  }
}

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
      await sleep(250);
      await sock.sendMessage(chatJid, {
        text: loadingFrames[i],
        edit: initialMsg.key
      }).catch(() => {});
    }

    await sleep(250);
    await sock.sendMessage(chatJid, {
      text: finalContent,
      edit: initialMsg.key
    }).catch(async () => {
      await sock.sendMessage(chatJid, { text: finalContent }, { quoted: quotedMsg });
    });
  } catch (err) {
    await sock.sendMessage(chatJid, { text: finalContent }, { quoted: quotedMsg });
  }
}

module.exports = {
  name: 'settings',
  alias: ['setting', 'set', 'config'],
  description: 'Manage individual bot settings with MongoDB and PIN security',
  async execute(sock, msg, args, chatJid, safeReply, { isOwner }) {
    if (!isOwner) {
      return await safeReply('⛔ *Access Denied!* Only Owner can modify settings.');
    }

    // මේ bot session එකේ phone number එක ලබාගැනීම
    const botNumber = (sock.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    let settings = getBotSettings ? (await getBotSettings(botNumber)) : {};
    if (!settings) settings = {};

    // Input එක ලබාගැනීම (Args වලින් හෝ direct message එකෙන්)
    let input = args.join(' ').trim();
    if (!input) {
      const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      input = rawText.trim();
    }

    const choice = input.toLowerCase();

    // 🟢 WORK MODE
    if (choice === '1.1') {
      if (updateBotSettings) await updateBotSettings(botNumber, { workMode: 'private' });
      return await applyWithLoader(sock, chatJid, msg, `✅ *[+${botNumber}]* Mode set to: *PRIVATE 🔒*`);
    }
    if (choice === '1.2') {
      if (updateBotSettings) await updateBotSettings(botNumber, { workMode: 'public' });
      return await applyWithLoader(sock, chatJid, msg, `✅ *[+${botNumber}]* Mode set to: *PUBLIC 🌐*`);
    }
    if (choice === '1.3') {
      if (updateBotSettings) await updateBotSettings(botNumber, { workMode: 'inbox' });
      return await applyWithLoader(sock, chatJid, msg, `✅ *[+${botNumber}]* Mode set to: *INBOX ONLY 📥*`);
    }
    if (choice === '1.4') {
      if (updateBotSettings) await updateBotSettings(botNumber, { workMode: 'groups' });
      return await applyWithLoader(sock, chatJid, msg, `✅ *[+${botNumber}]* Mode set to: *GROUPS ONLY 👥*`);
    }

    // 🟢 AUTO AI INBOX
    if (choice === '2.1') {
      if (updateBotSettings) await updateBotSettings(botNumber, { autoAiInbox: true });
      return await applyWithLoader(sock, chatJid, msg, `🤖 *[+${botNumber}]* Auto AI: *ENABLED 🟢*`);
    }
    if (choice === '2.2') {
      if (updateBotSettings) await updateBotSettings(botNumber, { autoAiInbox: false });
      return await applyWithLoader(sock, chatJid, msg, `🤖 *[+${botNumber}]* Auto AI: *DISABLED 🔴*`);
    }

    // 🟢 AUTO STATUS SEEN
    if (choice === '3.1') {
      if (updateBotSettings) await updateBotSettings(botNumber, { autoStatusSeen: true });
      return await applyWithLoader(sock, chatJid, msg, `👁️ *[+${botNumber}]* Status Seen: *ENABLED 🟢*`);
    }
    if (choice === '3.2') {
      if (updateBotSettings) await updateBotSettings(botNumber, { autoStatusSeen: false });
      return await applyWithLoader(sock, chatJid, msg, `👁️ *[+${botNumber}]* Status Seen: *DISABLED 🔴*`);
    }

    // 🟢 STATUS REACT
    if (choice === '4.1') {
      if (updateBotSettings) await updateBotSettings(botNumber, { statusReact: true });
      return await applyWithLoader(sock, chatJid, msg, `💐 *[+${botNumber}]* Status React: *ENABLED 🟢*`);
    }
    if (choice === '4.2') {
      if (updateBotSettings) await updateBotSettings(botNumber, { statusReact: false });
      return await applyWithLoader(sock, chatJid, msg, `💐 *[+${botNumber}]* Status React: *DISABLED 🔴*`);
    }

    // 🟢 OWNER REACT
    if (choice === '5.1') {
      if (updateBotSettings) await updateBotSettings(botNumber, { ownerReact: true });
      return await applyWithLoader(sock, chatJid, msg, `👑 *[+${botNumber}]* Owner React: *ENABLED 🟢*`);
    }
    if (choice === '5.2') {
      if (updateBotSettings) await updateBotSettings(botNumber, { ownerReact: false });
      return await applyWithLoader(sock, chatJid, msg, `👑 *[+${botNumber}]* Owner React: *DISABLED 🔴*`);
    }

    // 🟢 CHANGE EMOJI (.set 6 🔥)
    if (choice.startsWith('6')) {
      const parts = choice.split(/ +/);
      const emoji = parts[1];
      if (!emoji) return await safeReply('⚠️ කරුණාකර Emoji එකක් ලබාදෙන්න! (උදා: `6 🔥`)');
      if (updateBotSettings) await updateBotSettings(botNumber, { ownerReactEmoji: emoji });
      return await applyWithLoader(sock, chatJid, msg, `🎨 *[+${botNumber}]* New Owner Emoji: *${emoji}*`);
    }

    // 🟢 CHANGE PASSWORD/PIN (.set pin 5566)
    if (choice.startsWith('pin')) {
      const newPin = choice.split(/ +/)[1];
      if (!newPin || newPin.length < 4) {
        return await safeReply('⚠️ කරුණාකර අවම අංක 4ක නව Password එකක් දෙන්න! (උදා: `.set pin 7788`)');
      }
      if (updateBotSettings) await updateBotSettings(botNumber, { securityPin: newPin });
      return await applyWithLoader(sock, chatJid, msg, `🔐 *[+${botNumber}]* Security PIN Updated to: *${newPin}*`);
    }

    // 🟢 Main Settings Menu Card
    const stateBadge = (val) => (val ? '🟢 ON' : '🔴 OFF');
    const modeBadge = {
      public: 'PUBLIC 🌐',
      private: 'PRIVATE 🔒',
      inbox: 'INBOX 📥',
      groups: 'GROUPS 👥'
    }[settings.workMode || 'public'] || 'PUBLIC 🌐';

    const menu = `
╔══════════════════════════════════════╗
║      ⚡ HESHAN-MD BOT CONFIG ⚡       ║
╠══════════════════════════════════════╣
║ 🤖 *Target Bot :* +${botNumber}
║ 🔐 *Security   :* PIN Protected
╠══════════════════════════════════════╣
║                                      ║
║  [1] 🌐 WORK MODE [ ${modeBadge} ]
║      ├ 1.1 Private                   ║
║      ├ 1.2 Public                    ║
║      ├ 1.3 Inbox Only                ║
║      └ 1.4 Group Only                ║
║                                      ║
║  [2] 🤖 AUTO AI INBOX [ ${stateBadge(settings.autoAiInbox !== false)} ]
║      ├ 2.1 AI On                     ║
║      └ 2.2 AI Off                    ║
║                                      ║
║  [3] 👁️ AUTO STATUS SEEN [ ${stateBadge(settings.autoStatusSeen !== false)} ]
║      ├ 3.1 Status Seen On            ║
║      └ 3.2 Status Seen Off           ║
║                                      ║
║  [4] 💐 STATUS REACT [ ${stateBadge(settings.statusReact !== false)} ]
║      ├ 4.1 Status React On           ║
║      └ 4.2 Status React Off          ║
║                                      ║
║  [5] 👑 OWNER REACT [ ${stateBadge(settings.ownerReact !== false)} ]
║      ├ 5.1 Owner React On            ║
║      └ 5.2 Owner React Off           ║
║                                      ║
║  [6] 🎨 OWNER EMOJI [  ${settings.ownerReactEmoji || '👑'}  ]
║      └ Reply: 6 <emoji>              ║
║                                      ║
║  [7] 🔐 CHANGE PIN [ ${settings.securityPin || '1234'} ]
║      └ Command: .set pin <new_pin>   ║
║                                      ║
╠══════════════════════════════════════╣
║  🔢 පාලනය සඳහා:                      ║
║  • මේ මැසේජ් එකට අදාළ අංකය Reply     ║
║    කරන්න (උදා: 1.1 හෝ 2.2)           ║
║  • නැතහොත් .set 2.1 ලෙස යවන්න        ║
╚══════════════════════════════════════╝
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

    return await safeReply(menu);
  }
};

