// commands/menu.js
const fs = require('fs');
const path = require('path');

function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

// ⚡ Solid Logo Buffer Finder
let cachedLogo = null;
function getBotLogo() {
    if (cachedLogo) return cachedLogo;

    try {
        const localLogoPath = path.join(__dirname, '../logo.jpg');
        if (fs.existsSync(localLogoPath)) {
            cachedLogo = fs.readFileSync(localLogoPath);
            return cachedLogo;
        }

        const rootPath = path.join(process.cwd(), 'logo.jpg');
        if (fs.existsSync(rootPath)) {
            cachedLogo = fs.readFileSync(rootPath);
            return cachedLogo;
        }

        const assetsPath = path.join(process.cwd(), 'assets', 'logo.jpg');
        if (fs.existsSync(assetsPath)) {
            cachedLogo = fs.readFileSync(assetsPath);
            return cachedLogo;
        }
    } catch (e) {}

    return { url: 'https://raw.githubusercontent.com/diniduheshan40-design/HESH-MD/main/logo.jpg' };
}

const activeMenuSessions = new Map();

module.exports = {
  name: 'menu',
  alias: ['help', 'list', 'commands'],
  category: 'general',
  desc: 'Interactive categorized command menu',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : msg.key.remoteJid;

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
┣━━『 📑 *SELECT CATEGORY* 』
┃
┃ [1] 📥 *DOWNLOAD MENU*
┃ [2] 🛠️ *TOOLS & UTILITY*
┃ [3] 👥 *GROUP & ADMIN MENU*
┃ [4] ⚡ *SYSTEM & OWNER*
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
*👉 Select a category by replying with (1, 2, 3, or 4)*
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`;

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

    // Instant Reaction
    sock.sendMessage(targetChat, { react: { text: "📜", key: msg.key } }).catch(() => {});

    try {
      let sentMenu = null;
      const logo = getBotLogo();

      // 1. Try sending with Logo Image
      try {
        sentMenu = await sock.sendMessage(targetChat, {
            image: logo,
            caption: mainText,
            mimetype: 'image/jpeg'
        }, { quoted: msg });
      } catch (imgErr) {
        // Fallback: Image send fail වුවහොත් ක්ෂණිකව text message එක යවයි
        sentMenu = await sock.sendMessage(targetChat, { text: mainText }, { quoted: msg });
      }

      const menuMessageId = sentMenu?.key?.id;
      if (!menuMessageId) return;

      if (activeMenuSessions.has(targetChat)) {
        const prev = activeMenuSessions.get(targetChat);
        clearTimeout(prev.timeout);
        sock.ev.off('messages.upsert', prev.listener);
      }

      const replyListener = async (m) => {
        try {
          const replyMsg = m.messages?.[0];
          if (!replyMsg?.message || replyMsg.key.fromMe) return;

          const fromChat = replyMsg.key?.remoteJid;
          if (fromChat !== targetChat) return;

          let msgContent = replyMsg.message;
          if (msgContent.ephemeralMessage) msgContent = msgContent.ephemeralMessage.message;
          if (msgContent.viewOnceMessage) msgContent = msgContent.viewOnceMessage.message;
          if (msgContent.viewOnceMessageV2) msgContent = msgContent.viewOnceMessageV2.message;

          const contextInfo = msgContent?.extendedTextMessage?.contextInfo;
          if (!contextInfo || contextInfo.stanzaId !== menuMessageId) return;

          const replyText = (
            msgContent.conversation || 
            msgContent.extendedTextMessage?.text || 
            ""
          ).trim().replace(/[\[\].]/g, '');

          if (["1", "2", "3", "4"].includes(replyText)) {
            sock.ev.off('messages.upsert', replyListener);
            if (activeMenuSessions.has(targetChat)) {
              clearTimeout(activeMenuSessions.get(targetChat).timeout);
              activeMenuSessions.delete(targetChat);
            }

            const emojis = { "1": "📥", "2": "🛠️", "3": "👥", "4": "⚡" };
            sock.sendMessage(targetChat, { react: { text: emojis[replyText], key: replyMsg.key } }).catch(() => {});

            try {
              await sock.sendMessage(targetChat, { 
                image: getBotLogo(),
                caption: subMenus[replyText],
                mimetype: 'image/jpeg'
              }, { quoted: replyMsg });
            } catch (e) {
              await sock.sendMessage(targetChat, { text: subMenus[replyText] }, { quoted: replyMsg });
            }
          }
        } catch (e) {
          console.error("Menu Reply Error:", e.message);
        }
      };

      const timeout = setTimeout(() => {
        sock.ev.off('messages.upsert', replyListener);
        activeMenuSessions.delete(targetChat);
      }, 60000);

      activeMenuSessions.set(targetChat, { listener: replyListener, timeout });
      sock.ev.on('messages.upsert', replyListener);

    } catch (err) {
      console.error('Menu Execution Error:', err.message);
      await sock.sendMessage(targetChat, { text: mainText }, { quoted: msg }).catch(() => {});
    }
  }
};

