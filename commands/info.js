// commands/info.js
const os = require('os');
const process = require('process');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

function formatUptime(seconds) {
  seconds = Math.floor(Number(seconds) || 0);
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
}

module.exports = {
  name: 'info',
  alias: ['system', 'botinfo', 'status'],
  category: 'general',
  desc: 'Display system specs, uptime and bot status',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    sock.sendMessage(targetChat, { react: { text: "📊", key: msg.key } }).catch(() => {});

    // Accurate Real Network Ping (ms)
    const msgTimestamp = Number(msg.messageTimestamp) * 1000 || Date.now();
    const latency = Math.max(0, Date.now() - msgTimestamp);

    // RAM calculation
    const memoryUsage = process.memoryUsage();
    const processUsedMem = (memoryUsage.rss / (1024 * 1024)).toFixed(1);
    const totalMem = (os.totalmem() / (1024 * 1024)).toFixed(0);

    const platform = os.platform() === 'linux' ? 'Linux (Cloud VPS)' : os.platform();
    const uptime = formatUptime(process.uptime());

    // User name
    const pushName = msg.pushName || "User";
    let firstName = pushName.split(/[\s_+-]+/)[0] || "User";
    if (firstName.length > 15) firstName = firstName.substring(0, 15);

    const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const currentPrefix = (rawText && /^[.#/!]/.test(rawText.charAt(0))) ? rawText.charAt(0) : '.';

    // Dynamic Bot Settings & WorkMode
    const myBotJid = jidNormalizedUser(sock.user?.id || '');
    const myBotNum = myBotJid.replace(/\D/g, '');
    let workMode = 'Public';

    if (typeof global.getBotSettings === 'function') {
      const st = await global.getBotSettings(myBotNum);
      if (st?.workMode) workMode = st.workMode.toUpperCase();
    }

    // Real Live Active Bots Count (Dead sessions excluded)
    const sessions = global.activeSessions || {};
    const liveBotsCount = Object.values(sessions).filter(s => {
      return Boolean(s && s.user?.id && (s.ws?.readyState === 1 || s.ws?.socket?.readyState === 1));
    }).length;
    const finalBotCount = Math.max(liveBotsCount, 1);

    const infoCard = 
`╭━━〔 ⚡ 𝐇𝐄𝐒𝐇𝐀𝐍-𝐌𝐃 ⚡ 〕━━╮
┃ 
┃ ✦ ᴜsᴇʀ    : ${firstName}
┃ ✦ ᴘʀᴇғɪx  : ${currentPrefix}
┃ ✦ ʀᴜɴᴛɪᴍᴇ : ${uptime}
┃ ✦ sᴛᴀᴛᴜs  : Online 🟢
┃ ✦ ᴍᴏᴅᴇ    : ${workMode}
┃ ✦ ʙᴏᴛs    : ${finalBotCount} Active
┃
┣━━〔 📊 𝐒𝐘𝐒𝐓𝐄𝐌 𝐈𝐍𝐅𝐎 〕━━┫
┃
┃ ✦ ʀᴀᴍ     : ${processUsedMem}MB / ${totalMem}MB
┃ ✦ sᴘᴇᴇᴅ   : ${latency} ms
┃ ✦ ᴘʟᴀᴛғᴏʀᴍ: ${platform}
┃
╰━━━━━━━━━━━━━━━━━━━━━━╯
> 🔐 *heshan ofc • all rights reserved*`;

    try {
      if (typeof safeReply === 'function') {
        await safeReply(infoCard);
      } else {
        await sock.sendMessage(targetChat, { 
          text: infoCard,
          ...(global.channelContext || {})
        }, { quoted: msg });
      }
      sock.sendMessage(targetChat, { react: { text: "⚡", key: msg.key } }).catch(() => {});
    } catch (err) {
      console.error("Info Command Error:", err?.message || err);
    }
  }
};
