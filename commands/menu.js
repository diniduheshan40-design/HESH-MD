// commands/menu.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Local logo path check (root එකේ හරි commands එක ඇතුලෙ හරි)
const POSSIBLE_PATHS = [
  path.join(process.cwd(), 'logo.jpg'),
  path.join(process.cwd(), 'logo.png'),
  path.join(process.cwd(), 'assets', 'logo.jpg'),
  path.join(__dirname, '../logo.jpg')
];

// ස්ථිරවම වැඩ කරන public banner fallback url එකක්
const FALLBACK_LOGO_URL = 'https://i.ibb.co/vz6V20v/image.jpg';

function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

// Logo එක Buffer එකක් විදියට ගෙන දෙන function එක
async function getLogoBuffer() {
  // 1. මුලින්ම Local File එකක් තියෙනවද බලනවා
  for (const p of POSSIBLE_PATHS) {
    if (fs.existsSync(p)) {
      try {
        return fs.readFileSync(p);
      } catch (e) {}
    }
  }

  // 2. Local එකක් නැත්නම් URL එකෙන් Arraybuffer එකක් අරන් Buffer එක හදනවා
  try {
    const res = await axios.get(FALLBACK_LOGO_URL, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });
    return Buffer.from(res.data);
  } catch (err) {
    console.error("Logo Download Error:", err.message);
    return null;
  }
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
┃ [1] 📥 *DOWNLOAD MENU*
┃ [2] 🛠️ *TOOLS & UTILITY*
┃ [3] 👥 *GROUP & FUN MENU*
┃ [4] ⚡ *SYSTEM & OWNER*
┃
┗━━━━━━━━━━━━━━━━━━━━━┛
*👉 Select a category by replying with (1, 2, 3, or 4)*
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`;

    try {
      await sock.sendMessage(targetChat, { react: { text: "📜", key: msg.key } }).catch(() => {});

      // Logo එක Load කර ගැනීම
      const logoBuffer = await getLogoBuffer();

      let sentMenu;
      if (logoBuffer) {
        // Logo image එකක් Buffer විදියට යැවීම
        sentMenu = await sock.sendMessage(targetChat, {
          image: logoBuffer,
          caption: mainText,
          mimetype: 'image/jpeg'
        }, { quoted: msg });
      } else {
        // Logo එක කොහෙත්ම load නොවුනොත් URL object එකෙන් try කිරීම
        sentMenu = await sock.sendMessage(targetChat, {
          image: { url: FALLBACK_LOGO_URL },
          caption: mainText
        }, { quoted: msg }).catch(async () => {
          // ඒකත් බැරි උනොත් Text එක විතරක් යැවීම
          return await sock.sendMessage(targetChat, { text: mainText }, { quoted: msg });
        });
      }

      const menuMessageId = sentMenu?.key?.id;

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

      // 🟢 Reply Listener (1, 2, 3, 4)
      const replyListener = async (m) => {
        try {
          const replyMsg = m.messages?.[0];
          if (!replyMsg || !replyMsg.message || replyMsg.key.fromMe) return;

          const fromChat = replyMsg.key?.remoteJid;
          if (fromChat !== targetChat) return;

          let msgContent = replyMsg.message;
          if (msgContent.ephemeralMessage) msgContent = msgContent.ephemeralMessage.message;
          if (msgContent.viewOnceMessage) msgContent = msgContent.viewOnceMessage.message;

          const replyText = (
            msgContent.conversation || 
            msgContent.extendedTextMessage?.text || 
            ""
          ).trim().replace(/[\[\].]/g, '');

          if (["1", "2", "3", "4"].includes(replyText)) {
            // Group එකකදී අදාළ menu එකට reply නොකර නිකන් 1, 2, 3 දැම්මොත් ignore කරයි
            const contextInfo = msgContent.extendedTextMessage?.contextInfo;
            const isQuotedMenu = contextInfo && contextInfo.stanzaId === menuMessageId;
            if (targetChat.endsWith('@g.us') && !isQuotedMenu) return;

            sock.ev.off('messages.upsert', replyListener);

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

      // තත්පර 60කින් listener එක clear වෙයි
      setTimeout(() => {
        sock.ev.off('messages.upsert', replyListener);
      }, 60000);

    } catch (err) {
      console.error('Error in menu command:', err.message);
      await sock.sendMessage(targetChat, { text: mainText }, { quoted: msg }).catch(() => {});
    }
  }
};

