// commands/menu.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');

const FALLBACK_LOGO_URL = 'https://files.catbox.moe/a58add.jpeg';

// Database Model
const SettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  botLogo: { type: String, default: FALLBACK_LOGO_URL }
}, { strict: false });

const SettingsModel = mongoose.models.BotSettings || mongoose.model('BotSettings', SettingsSchema);

function formatUptime(seconds) {
    seconds = Math.floor(Number(seconds) || 0);
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

// එක් එක් Bot Instance එකට ගැලපෙන Logo එක කියවා ගැනීම
async function fetchLogoForBot(botNum) {
    // 1. මේ Bot Number එකට වෙනම හදපු Local file එකක් තියෙනවාද බැලීම
    const specificLogo = path.join(process.cwd(), `logo_${botNum}.jpg`);
    if (fs.existsSync(specificLogo)) {
        try {
            return fs.readFileSync(specificLogo);
        } catch (e) {}
    }

    // 2. Database එකෙන් Bot Logo එක check කිරීම
    try {
        const s = await SettingsModel.findById(botNum).lean();
        if (s && s.botLogo) {
            if (fs.existsSync(s.botLogo)) {
                return fs.readFileSync(s.botLogo);
            }
            if (s.botLogo.startsWith('http')) {
                const response = await axios.get(s.botLogo, { responseType: 'arraybuffer', timeout: 10000 });
                return Buffer.from(response.data);
            }
        }
    } catch (e) {}

    // 3. Fallback Default Logo
    try {
        const response = await axios.get(FALLBACK_LOGO_URL, { 
            responseType: 'arraybuffer',
            timeout: 10000 
        });
        return Buffer.from(response.data);
    } catch (e) {
        return { url: FALLBACK_LOGO_URL };
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

    // Active Bot ගේ අංකය ලබාගැනීම
    const myBotNum = (sock.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

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

    try {
      await sock.sendMessage(targetChat, { react: { text: "📜", key: msg.key } }).catch(() => {});

      // මේ Bot Instance එකට විතරක් අදාළ Logo එක ලබාගැනීම
      const logoImg = await fetchLogoForBot(myBotNum);

      const sentMenu = await sock.sendMessage(targetChat, {
          image: logoImg,
          caption: mainText
      }, { quoted: msg }).catch(async (imgErr) => {
          console.error("Image Send Error:", imgErr.message);
          return await sock.sendMessage(targetChat, { text: mainText }, { quoted: msg });
      });

      const menuMessageId = sentMenu?.key?.id;

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

      setTimeout(() => {
        sock.ev.off('messages.upsert', replyListener);
      }, 60000);

    } catch (err) {
      console.error('Error in menu command:', err.message);
      await sock.sendMessage(targetChat, { text: mainText }, { quoted: msg }).catch(() => {});
    }
  }
};

