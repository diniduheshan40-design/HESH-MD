// commands/menu.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const LOCAL_LOGO = path.join(process.cwd(), 'logo.jpg');
const FALLBACK_LOGO_URL = 'https://files.catbox.moe/gs150o.jpg';

function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

module.exports = {
  name: 'menu',
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
┃ ➊ 📥 *DOWNLOAD MENU*
┃ ➋ 🛠️ *TOOLS & UTILITY*
┃ ➌ 👥 *GROUP & FUN MENU*
┃ ➍ ⚡ *SYSTEM & OWNER*
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
*👉 Select a category by replying with (1, 2, 3, or 4)*
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`;

    try {
      await sock.sendMessage(targetChat, { react: { text: "📜", key: msg.key } }).catch(() => {});

      // 🟢 1. Bulletproof Image Buffer Loader (Zero Dropping)
      let imgBuffer = null;
      if (fs.existsSync(LOCAL_LOGO)) {
        imgBuffer = fs.readFileSync(LOCAL_LOGO);
      } else {
        try {
          const res = await axios.get(FALLBACK_LOGO_URL, { 
            responseType: 'arraybuffer',
            timeout: 10000 
          });
          imgBuffer = Buffer.from(res.data, 'binary');
        } catch (e) {
          // Backup logo url fetch
          const res2 = await axios.get('https://files.catbox.moe/a58add.jpeg', {
            responseType: 'arraybuffer',
            timeout: 10000
          }).catch(() => null);
          if (res2) imgBuffer = Buffer.from(res2.data, 'binary');
        }
      }

      // 🟢 2. Send Message with Image Buffer
      let sentMsg = null;
      if (imgBuffer) {
        sentMsg = await sock.sendMessage(targetChat, {
          image: imgBuffer,
          caption: mainText
        }, { quoted: msg });
      } else {
        sentMsg = await sock.sendMessage(targetChat, {
          image: { url: FALLBACK_LOGO_URL },
          caption: mainText
        }, { quoted: msg });
      }

      const stanzaId = sentMsg?.key?.id;
      const usedOptions = new Set();

      // Sub-menu definitions
      const subMenus = {
        "1": `┏━━━❮ 📥 *DOWNLOAD MENU* ❯━━━┓
┃
┃ ◈ \`.song\`   ⌁ _<music mp3>_
┃ ◈ \`.video\`  ⌁ _<youtube mp4>_
┃ ◈ \`.fb\`     ⌁ _<facebook video>_
┃ ◈ \`.tiktok\` ⌁ _<tiktok video>_
┃ ◈ \`.insta\`  ⌁ _<instagram post>_
┃ ◈ \`.apk\`    ⌁ _<android app>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,

        "2": `┏━━━❮ 🛠️ *TOOLS & UTILITY* ❯━━━┓
┃
┃ ◈ \`.pt\`      ⌁ _<photo to sticker/tool>_
┃ ◈ \`.tourl\`   ⌁ _<media to link>_
┃ ◈ \`.getdp\`   ⌁ _<get profile picture>_
┃ ◈ \`.vv\`      ⌁ _<view once reveal>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,

        "3": `┏━━━❮ 👥 *GROUP & FUN* ❯━━━┓
┃
┃ ◈ \`.tagall\`  ⌁ _<mention all members>_
┃ ◈ \`.hack\`    ⌁ _<prank hack UI>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,

        "4": `┏━━━❮ ⚡ *SYSTEM & OWNER* ❯━━━┓
┃
┃ ◈ \`.ping\`    ⌁ _<response speed>_
┃ ◈ \`.alive\`   ⌁ _<bot online status>_
┃ ◈ \`.restart\` ⌁ _<clean ram & reboot>_
┃ ◈ \`.setlogo\` ⌁ _<update bot banner>_
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`
      };

      // 1, 2, 3, 4 Reply Listener
      const replyListener = async (m) => {
        try {
          const replyMsg = m.messages?.[0];
          if (!replyMsg || !replyMsg.message) return;

          let msgContent = replyMsg.message;
          if (msgContent.ephemeralMessage) msgContent = msgContent.ephemeralMessage.message;
          if (msgContent.viewOnceMessage) msgContent = msgContent.viewOnceMessage.message;

          const msgContext = msgContent?.extendedTextMessage?.contextInfo;
          if (stanzaId && msgContext?.stanzaId !== stanzaId) return;

          const replyText = (
            msgContent.conversation || 
            msgContent.extendedTextMessage?.text || 
            ""
          ).trim();

          if (["1", "2", "3", "4"].includes(replyText)) {
            if (usedOptions.has(replyText)) return;
            usedOptions.add(replyText);

            const emojis = { "1": "📥", "2": "🛠️", "3": "👥", "4": "⚡" };
            await sock.sendMessage(targetChat, { react: { text: emojis[replyText], key: replyMsg.key } }).catch(() => {});

            await sock.sendMessage(targetChat, { 
              text: subMenus[replyText] 
            }, { quoted: replyMsg });
          }
        } catch (e) {
          console.error("Menu Listener Error:", e.message);
        }
      };

      sock.ev.on('messages.upsert', replyListener);

      setTimeout(() => {
        sock.ev.off('messages.upsert', replyListener);
      }, 90000);

    } catch (err) {
      console.error('Error in menu command:', err.message);
      await sock.sendMessage(targetChat, { text: mainText }, { quoted: msg }).catch(() => {});
    }
  }
};

