// commands/menu.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');

const FALLBACK_LOGO_URL = 'https://files.catbox.moe/a58add.jpeg';

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

// Logo එක Buffer එකක් විදියට ලබාගැනීම
async function fetchLogoBuffer(botNum) {
    // 1. Local image check
    const localFile = path.join(process.cwd(), `logo_${botNum}.jpg`);
    if (fs.existsSync(localFile)) {
        try {
            return fs.readFileSync(localFile);
        } catch (e) {}
    }

    // 2. DB URL check
    let targetUrl = FALLBACK_LOGO_URL;
    try {
        const s = await SettingsModel.findById(botNum).lean();
        if (s && s.botLogo && s.botLogo.startsWith('http')) {
            targetUrl = s.botLogo;
        }
    } catch (e) {}

    // 3. Download Buffer with User-Agent
    try {
        const res = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });
        if (res.status === 200 && res.data) {
            return Buffer.from(res.data);
        }
    } catch (err) {
        console.error("Logo buffer fetch failed, using direct URL:", err.message);
    }

    return { url: targetUrl };
}

module.exports = {
  name: 'menu',
  category: 'general',
  desc: 'Interactive categorized command menu',

  async execute(sock, msg, args, chatJid) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : msg.key.remoteJid;

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

      const logo = await fetchLogoBuffer(myBotNum);

      const messagePayload = Buffer.isBuffer(logo) 
        ? { image: logo, caption: mainText, mimetype: 'image/jpeg' }
        : { image: { url: FALLBACK_LOGO_URL }, caption: mainText };

      const sentMenu = await sock.sendMessage(targetChat, messagePayload, { quoted: msg });
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

          const contextInfo = msgContent.extendedTextMessage?.contextInfo;
          if (!contextInfo || contextInfo.stanzaId !== menuMessageId) return;

          const replyText = (
            msgContent.conversation || 
            msgContent.extendedTextMessage?.text || 
            ""
          ).trim().replace(/[\[\].]/g, '');

          if (["1", "2", "3", "4"].includes(replyText)) {
            sock.ev.off('messages.upsert', replyListener);

            const emojis = { "1": "📥", "2": "🛠️", "3": "👥", "4": "⚡" };
            await sock.sendMessage(targetChat, { react: { text: emojis[replyText], key: replyMsg.key } }).catch(() => {});

            const subLogo = await fetchLogoBuffer(myBotNum);
            const subPayload = Buffer.isBuffer(subLogo)
              ? { image: subLogo, caption: subMenus[replyText], mimetype: 'image/jpeg' }
              : { image: { url: FALLBACK_LOGO_URL }, caption: subMenus[replyText] };

            await sock.sendMessage(targetChat, subPayload, { quoted: replyMsg }).catch(async () => {
              await sock.sendMessage(targetChat, { text: subMenus[replyText] }, { quoted: replyMsg });
            });
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

