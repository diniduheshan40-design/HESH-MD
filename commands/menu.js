// commands/menu.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

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

const subMenus = {
  "1": `┏━━━❮ 📥 *DOWNLOAD MENU* ❯━━━┓
┃
┃ ◈ \`.song\`      ⌁ _<music mp3>_
┃ ◈ \`.video\`     ⌁ _<youtube mp4>_
┃ ◈ \`.fb\`        ⌁ _<facebook video>_
┃ ◈ \`.tiktok\`    ⌁ _<tiktok video>_
┃ ◈ \`.insta\`     ⌁ _<instagram post>_
┃ ◈ \`.apk\`       ⌁ _<android app>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,

  "2": `┏━━━❮ 🛠️ *TOOLS & UTILITY* ❯━━━┓
┃
┃ ◈ \`.pt\`         ⌁ _<photo to sticker/tool>_
┃ ◈ \`.tourl\`      ⌁ _<media to link>_
┃ ◈ \`.getdp\`      ⌁ _<get profile picture>_
┃ ◈ \`.vv\`         ⌁ _<view once reveal>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,

  "3": `┏━━━❮ 👥 *GROUP & ADMIN MENU* ❯━━━┓
┃
┃ ◈ \`.tagall\`     ⌁ _<mention all members>_
┃ ◈ \`.kick\`       ⌁ _<remove user>_
┃ ◈ \`.add\`        ⌁ _<add member by num>_
┃ ◈ \`.promote\`    ⌁ _<make group admin>_
┃ ◈ \`.demote\`     ⌁ _<dismiss group admin>_
┃ ◈ \`.mute\`       ⌁ _<close group (admin only)>_
┃ ◈ \`.unmute\`     ⌁ _<open group (everyone)>_
┃ ◈ \`.link\`       ⌁ _<get invite link>_
┃ ◈ \`.revoke\`     ⌁ _<reset invite link>_
┃ ◈ \`.setname\`    ⌁ _<change group title>_
┃ ◈ \`.setdesc\`    ⌁ _<change description>_
┃ ◈ \`.hack\`       ⌁ _<prank hack UI>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,

  "4": `┏━━━❮ ⚡ *SYSTEM & OWNER* ❯━━━┓
┃
┃ ◈ \`.ping\`       ⌁ _<response speed>_
┃ ◈ \`.alive\`      ⌁ _<bot online status>_
┃ ◈ \`.restart\`    ⌁ _<clean ram & reboot>_
┃ ◈ \`.setlogo\`    ⌁ _<update bot banner>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`
};

module.exports = {
  name: 'menu',
  alias: ['help', 'list', 'commands'],
  category: 'general',
  desc: 'Interactive categorized command menu',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // ⚡ Channel Context Info (✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨ + View Channel button)
    const channelContext = global.channelContext?.contextInfo || {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: '120363421906774107@newsletter',
            newsletterName: '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨',
            serverMessageId: 1
        }
    };

    // Direct Argument හෝ Reply කළ අගය (1, 2, 3, 4)
    let selectedCategory = args && args[0] ? args[0].trim() : null;

    // Submenu එකක් නම් Image එක සමඟ Channel Badge සහිතව යැවීම
    if (selectedCategory && subMenus[selectedCategory]) {
        const emojis = { "1": "📥", "2": "🛠️", "3": "👥", "4": "⚡" };
        sock.sendMessage(targetChat, { react: { text: emojis[selectedCategory] || "📜", key: msg.key } }).catch(() => {});
        
        try {
            const logo = await getBotLogo();
            if (logo) {
                return await sock.sendMessage(targetChat, {
                    image: logo,
                    caption: subMenus[selectedCategory],
                    mimetype: 'image/jpeg',
                    contextInfo: channelContext
                }, { quoted: msg });
            }
        } catch (e) {}

        return await sock.sendMessage(targetChat, { 
            text: subMenus[selectedCategory],
            contextInfo: channelContext
        }, { quoted: msg });
    }

    // Main Menu එක Render කිරීම
    let pushName = msg.pushName || "User";
    let firstName = pushName.split(/[\s_+-]+/)[0] || "User";
    if (firstName.length > 15) firstName = firstName.substring(0, 15);

    const uptime = formatUptime(process.uptime());

    const mainText = `┏━━━❮ ⚡ *𝐇𝐄𝐒𝐇𝐀𝐍 - 𝐌𝐃* ⚡ ❯━━━┓
┃
┣━━『 👤 *USER PROFILE* 』
┃ ◈ *User*    : *${firstName}*
┃ ◈ *Prefix*  : *. [Dot]*
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
> 💡 *මෙම පණිවිඩයට අංකය (1, 2, 3, 4) Reply කරන්න.*
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`;

    sock.sendMessage(targetChat, { react: { text: "📜", key: msg.key } }).catch(() => {});

    try {
      const logo = await getBotLogo();
      if (logo) {
          await sock.sendMessage(targetChat, {
              image: logo,
              caption: mainText,
              mimetype: 'image/jpeg',
              contextInfo: channelContext
          }, { quoted: msg });
          return;
      }
    } catch (err) {}

    await sock.sendMessage(targetChat, { 
        text: mainText,
        contextInfo: channelContext
    }, { quoted: msg }).catch(() => {});
  }
};

