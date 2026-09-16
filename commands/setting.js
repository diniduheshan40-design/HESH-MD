const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const settingsPath = path.join(__dirname, '../settings.json');

const defaultSettings = {
  workMode: 'public',
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
      await sleep(250);
      await sock.sendMessage(chatJid, {
        text: loadingFrames[i],
        edit: initialMsg.key
      });
    }

    await sleep(300);

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
  description: 'Clean Image-Card Bot Settings Panel',
  async execute(sock, msg, args, chatJid, safeReply, { isOwner }) {
    if (!isOwner) {
      return await safeReply('⛔ *Access Denied!* Master Creator පමණි.');
    }

    let settings = getSettings();

    // Context detection (Image caption හෝ text එක check කිරීම)
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quotedMsg?.conversation || 
                       quotedMsg?.extendedTextMessage?.text || 
                       quotedMsg?.imageMessage?.caption || '';

    const isReplyToMenu = quotedText.includes('HESHAN-MD SYSTEM SETTINGS');

    let input = args.join(' ').trim();
    if (!input && isReplyToMenu) {
      const currentRaw = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      input = currentRaw.trim();
    }

    const choice = input.toLowerCase();

    // 🟢 1. WORK MODE
    if (choice === '1.1') {
      settings.workMode = 'private';
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n🌐 *Work Mode* : *PRIVATE 🔒*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '1.2') {
      settings.workMode = 'public';
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n🌐 *Work Mode* : *PUBLIC 🌐*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '1.3') {
      settings.workMode = 'inbox';
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n🌐 *Work Mode* : *INBOX ONLY 📥*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '1.4') {
      settings.workMode = 'groups';
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n🌐 *Work Mode* : *GROUPS ONLY 👥*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 2. AUTO AI
    if (choice === '2.1') {
      settings.autoAiInbox = true;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n🤖 *Auto AI Inbox* : *ENABLED 🟢*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '2.2') {
      settings.autoAiInbox = false;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n🤖 *Auto AI Inbox* : *DISABLED 🔴*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 3. AUTO STATUS SEEN
    if (choice === '3.1') {
      settings.autoStatusSeen = true;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n👁️ *Auto Status Seen* : *ENABLED 🟢*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '3.2') {
      settings.autoStatusSeen = false;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n👁️ *Auto Status Seen* : *DISABLED 🔴*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 4. STATUS REACT
    if (choice === '4.1') {
      settings.statusReact = true;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n💐 *Status React* : *ENABLED 🟢*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '4.2') {
      settings.statusReact = false;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n💐 *Status React* : *DISABLED 🔴*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 5. OWNER REACT
    if (choice === '5.1') {
      settings.ownerReact = true;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n👑 *Owner React* : *ENABLED 🟢*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }
    if (choice === '5.2') {
      settings.ownerReact = false;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n👑 *Owner React* : *DISABLED 🔴*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 6. OWNER EMOJI
    if (choice.startsWith('6')) {
      const parts = choice.split(/ +/);
      const emoji = parts[1];
      if (!emoji) {
        return await safeReply('⚠️ කරුණාකර Emoji එකක් ලබා දෙන්න!\n_උදා: `.set 6 ⚡`_');
      }
      settings.ownerReactEmoji = emoji;
      saveSettings(settings);
      return await applyWithLoader(sock, chatJid, msg, `*⚙️ SYSTEM NOTIFICATION*\n───────────────────\n🎨 *Owner Emoji* : *${emoji}*\n───────────────────\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`);
    }

    // 🟢 UI Menu Caption
    const stateBadge = (val) => (val ? '🟢 ON' : '🔴 OFF');
    const modeBadge = {
      public: 'PUBLIC 🌐',
      private: 'PRIVATE 🔒',
      inbox: 'INBOX 📥',
      groups: 'GROUPS 👥'
    }[settings.workMode] || 'PUBLIC 🌐';

    const menuCaption = `*⚡ HESHAN-MD SYSTEM SETTINGS ⚡*
────────────────────────────
*🟢 Operational Core* : Online
*👑 Master Access*    : Verified
────────────────────────────

*1️⃣ WORK MODE* ⌁ [ ${modeBadge} ]
  ├ *1.1* ⇢ Private
  ├ *1.2* ⇢ Public
  ├ *1.3* ⇢ Inbox Only
  └ *1.4* ⇢ Group Only

*2️⃣ AUTO AI INBOX* ⌁ [ ${stateBadge(settings.autoAiInbox)} ]
  ├ *2.1* ⇢ AI Turn On
  └ *2.2* ⇢ AI Turn Off

*3️⃣ AUTO STATUS SEEN* ⌁ [ ${stateBadge(settings.autoStatusSeen)} ]
  ├ *3.1* ⇢ Status Seen On
  └ *3.2* ⇢ Status Seen Off

*4️⃣ STATUS REACTION* ⌁ [ ${stateBadge(settings.statusReact)} ]
  ├ *4.1* ⇢ React On
  └ *4.2* ⇢ React Off

*5️⃣ OWNER REACT* ⌁ [ ${stateBadge(settings.ownerReact)} ]
  ├ *5.1* ⇢ Owner React On
  └ *5.2* ⇢ Owner React Off

*6️⃣ OWNER EMOJI* ⌁ [ ${settings.ownerReactEmoji || '👑'} ]
  └ Type \`.set 6 <emoji>\` to change

────────────────────────────
💡 *පාලනය කිරීම සඳහා:*
• මේ Image එකට අදාළ අංකය Reply කරන්න (උදා: *1.2* හෝ *2.1*)
• නැතහොත් \`.set 1.2\`, \`.set 6 🔥\` ලෙස යවන්න.
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

    // 🟢 Send with Bot Logo Card
    const logoUrl = 'https://files.catbox.moe/a58add.jpeg';

    try {
      const resImg = await fetch(logoUrl);
      const imgBuffer = await resImg.buffer();
      await sock.sendMessage(chatJid, {
        image: imgBuffer,
        caption: menuCaption
      }, { quoted: msg });
    } catch (e) {
      await sock.sendMessage(chatJid, {
        image: { url: logoUrl },
        caption: menuCaption
      }, { quoted: msg }).catch(async () => {
        await safeReply(menuCaption);
      });
    }
  }
};

