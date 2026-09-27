// commands/menu.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

// 👑 ROOT DEVELOPER NUMBER
const DEVELOPER_NUMBER = '94719845166';
const DEFAULT_LOGO_BACKUP = 'https://files.catbox.moe/a58add.jpeg';

function formatUptime(seconds) {
  seconds = Math.floor(Number(seconds) || 0);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

// ⚡ Dynamic Session Logo Resolver (Isolated for each bot)
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

const subMenus = {
  "1": `┏━━━❮ 📥 *DOWNLOAD MENU* ❯━━━┓
┃
┃ ◈ \`.song\`      ⌁ _<music mp3 audio>_
┃ ◈ \`.video\`     ⌁ _<youtube mp4 video>_
┃ ◈ \`.fb\`        ⌁ _<facebook video/reel>_
┃ ◈ \`.insta\`     ⌁ _<instagram post/reel>_
┃ ◈ \`.pt\`        ⌁ _<pinterest video/image>_
┃ ◈ \`.img\`       ⌁ _<google image search>_
┃ ◈ \`.apk\`       ⌁ _<android app installer>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
🔗 *Pair Station :* https://heshan.devofc.top

> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,

  "2": `┏━━━❮ 🛠️ *TOOLS & UTILITY* ❯━━━┓
┃
┃ ◈ \`.s\`          ⌁ _<photo/video to sticker>_
┃ ◈ \`.toimg\`      ⌁ _<sticker to image>_
┃ ◈ \`.tomp3\`      ⌁ _<video to mp3 audio>_
┃ ◈ \`.vv\`         ⌁ _<save view-once media>_
┃ ◈ \`.getdp\`      ⌁ _<download profile picture>_
┃ ◈ \`.bot\`       ⌁ _<generate pairing code>_
┃ ◈ \`.autostatus\` ⌁ _<auto download status>_
┃ ◈ \`.hack\`       ⌁ _<prank cyber terminal>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
🔗 *Pair Station :* https://heshan.devofc.top

> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,

  "3": `┏━━━❮ 👥 *GROUP & ADMIN MENU* ❯━━━┓
┃
┃ ◈ \`.tagall\`     ⌁ _<mention all members>_
┃ ◈ \`.kick\`       ⌁ _<remove user from group>_
┃ ◈ \`.add\`        ⌁ _<add member by number>_
┃ ◈ \`.promote\`    ⌁ _<make group admin>_
┃ ◈ \`.demote\`     ⌁ _<dismiss group admin>_
┃ ◈ \`.mute\`       ⌁ _<close group (admin only)>_
┃ ◈ \`.unmute\`     ⌁ _<open group (all members)>_
┃ ◈ \`.link\`       ⌁ _<get group invite link>_
┃ ◈ \`.revoke\`     ⌁ _<reset invite link>_
┃ ◈ \`.join\`       ⌁ _<join group via link>_
┃ ◈ \`.leave\`      ⌁ _<leave current group>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
🔗 *Pair Station :* https://heshan.devofc.top

> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,

  "4": `┏━━━❮ ⚡ *SYSTEM & OWNER* ❯━━━┓
┃
┃ ◈ \`.info\`       ⌁ _<system specs & ram>_
┃ ◈ \`.mode\`       ⌁ _<switch public/private>_
┃ ◈ \`.settings\`   ⌁ _<bot configuration panel>_
┃ ◈ \`.setlogo\`    ⌁ _<change session logo>_
┃ ◈ \`.setdp\`      ⌁ _<update bot profile pic>_
┃ ◈ \`.sendst\`     ⌁ _<post whatsapp status>_
┃ ◈ \`.bc\`         ⌁ _<broadcast to groups>_
┃ ◈ \`.block\`      ⌁ _<block whatsapp user>_
┃ ◈ \`.unblock\`    ⌁ _<unblock whatsapp user>_
┃ ◈ \`.logout\`     ⌁ _<purge bot session>_
┃ ◈ \`.restart\`    ⌁ _<reboot system process>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
🔗 *Pair Station :* https://heshan.devofc.top

> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`
};

module.exports = {
  name: 'menu',
  alias: ['help', 'list', 'commands', 'panel'],
  category: 'general',
  desc: 'Interactive categorized command menu',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const channelContext = global.channelContext || {};

    // ⚡ 1. SENDER & BOT DETAILS RESOLUTION
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
    const myBotJid = jidNormalizedUser(sock.user?.id || '');
    const myBotNum = myBotJid.replace(/\D/g, '') || 'Online';

    let userRole = 'Member';
    if (cleanSenderNum === DEVELOPER_NUMBER) {
      userRole = '👑 Developer';
    } else if (cleanSenderNum === myBotNum || msg.key?.fromMe) {
      userRole = 'Owner';
    }

    // Work Mode fetch
    let workMode = 'PUBLIC';
    if (typeof global.getBotSettings === 'function' && myBotNum) {
      const st = await global.getBotSettings(myBotNum);
      if (st?.workMode) workMode = st.workMode.toUpperCase();
    }

    // ⚡ 2. SUB-MENU SELECTION (1, 2, 3, 4)
    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    let selectedCategory = (args && args[0]) ? args[0].trim() : null;

    if (!selectedCategory && ['1', '2', '3', '4'].includes(rawText)) {
      selectedCategory = rawText;
    }

    if (selectedCategory && subMenus[selectedCategory]) {
      const emojis = { "1": "📥", "2": "🛠️", "3": "👥", "4": "⚡" };
      sock.sendMessage(targetChat, { react: { text: emojis[selectedCategory] || "📜", key: msg.key } }).catch(() => {});

      const logoBuffer = await getBotLogoBuffer(myBotNum);
      if (logoBuffer) {
        return await sock.sendMessage(targetChat, {
          image: logoBuffer,
          caption: subMenus[selectedCategory],
          mimetype: 'image/jpeg',
          ...channelContext
        }, { quoted: msg });
      }

      return await sock.sendMessage(targetChat, { 
        text: subMenus[selectedCategory],
        ...channelContext
      }, { quoted: msg });
    }

    // ⚡ 3. MAIN MENU RENDERING
    let pushName = msg.pushName || "User";
    let firstName = pushName.split(/[\s_+-]+/)[0] || "User";
    if (firstName.length > 15) firstName = firstName.substring(0, 15);

    const uptime = formatUptime(process.uptime());

    const mainText = 
`┏━━━❮ ⚡ *𝐇𝐄𝐒𝐇𝐀𝐍 - 𝐌𝐃* ⚡ ❯━━━┓
┃
┣━━『 👤 *USER PROFILE* 』
┃ ◈ *User*    : *${firstName}*
┃ ◈ *Role*    : *${userRole}*
┃ ◈ *Bot Num* : *+${myBotNum}*
┃ ◈ *Mode*    : *${workMode}*
┃ ◈ *Prefix*  : *[ . ]*
┃ ◈ *Runtime* : *${uptime}*
┃ ◈ *Status*  : *Active 🟢*
┃
┣━━『 📑 *COMMAND CATEGORIES* 』
┃
┃ ◈ *1*  ➜ 📥 *DOWNLOAD MENU*
┃ ◈ *2*  ➜ 🛠️ *TOOLS & UTILITY*
┃ ◈ *3*  ➜ 👥 *GROUP & ADMIN*
┃ ◈ *4*  ➜ ⚡ *SYSTEM & OWNER*
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
🔗 *Pair Station :* https://heshan.devofc.top

> 💡 *මෙම පණිවිඩයට අංකය (1, 2, 3, 4) Reply කරන්න.*
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

    sock.sendMessage(targetChat, { react: { text: "📜", key: msg.key } }).catch(() => {});

    try {
      const logoBuffer = await getBotLogoBuffer(myBotNum);
      if (logoBuffer) {
        return await sock.sendMessage(targetChat, {
          image: logoBuffer,
          caption: mainText,
          mimetype: 'image/jpeg',
          ...channelContext
        }, { quoted: msg });
      }
    } catch (err) {}

    await sock.sendMessage(targetChat, { 
      text: mainText,
      ...channelContext
    }, { quoted: msg }).catch(() => {});
  }
};
