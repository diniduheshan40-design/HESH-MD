// commands/bots.js
const MASTER_OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '72787431583987'
];

module.exports = {
  name: 'bots',
  alias: ['activebots', 'sessions', 'botlist'],
  category: 'owner',
  desc: 'View real active and live connected bot sessions',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // ⚡ Owner Verification (LID + Phone Number)
    const rawParticipant = msg.key?.participant || msg.participant || targetChat || '';
    const cleanSender = rawParticipant.replace(/[^0-9]/g, '');

    const isMasterOwner = Boolean(
      MASTER_OWNER_NUMBERS.some(owner => cleanSender.includes(owner) || rawParticipant.includes(owner)) ||
      msg.key?.fromMe ||
      options?.isOwner
    );

    if (!isMasterOwner) {
      return await sock.sendMessage(targetChat, { 
        text: '⛔ *Access Denied!* මෙම තොරතුරු බැලිය හැක්කේ Master Owner හට පමණි.' 
      }, { quoted: msg });
    }

    sock.sendMessage(targetChat, { react: { text: "🔍", key: msg.key } }).catch(() => {});

    const activeSessions = global.activeSessions || {};
    const allSessionKeys = Object.keys(activeSessions);

    // ⚡ Real Active Filter (Socket එක OPEN & Authenticated අය පමණක් තෝරා ගැනීම)
    const liveBots = [];
    const deadBots = [];

    for (const num of allSessionKeys) {
      const s = activeSessions[num];
      // WebSocket readyState === 1 කියන්නේ Socket එක Live Open
      const isWsOpen = s?.ws?.readyState === 1 || s?.ws?.socket?.readyState === 1;
      const isUserLoaded = Boolean(s?.user?.id);

      if (s && isWsOpen && isUserLoaded) {
        liveBots.push(num);
      } else {
        deadBots.push(num);
      }
    }

    if (liveBots.length === 0) {
      return await sock.sendMessage(targetChat, {
        text: `╭───❮ ⚡ *HESHAN-MD BOT MONITOR* ⚡ ❯───╮
│
│ ⚠️ *දැනට කිසිදු Live Active Bot කෙනෙක් නොමැත!*
│ 🥀 Total Disconnected Slots: ${deadBots.length}
│
╰───────────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`,
        contextInfo: global.channelContext?.contextInfo || {}
      }, { quoted: msg });
    }

    // 📋 Real Live Bots List
    let listText = '';
    liveBots.forEach((num, index) => {
      listText += `│  [${index + 1}] +${num} 🟢 LIVE\n`;
    });

    const report = `╭───❮ ⚡ *LIVE BOT MONITOR* ⚡ ❯───╮
│
├ 🟢 *Real Live Bots :* ${liveBots.length} Active
├ 🔴 *Inactive Slots :* ${deadBots.length} Disconnected
├ 📊 *Total Slots    :* ${allSessionKeys.length}
├ 👑 *Monitor Master :* +94719845166
│
├──────❮ 🤖 *ACTIVE WORKERS* ❯──────╮
│
${listText}│
╰───────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

    await sock.sendMessage(targetChat, {
      text: report,
      contextInfo: global.channelContext?.contextInfo || {}
    }, { quoted: msg });

    sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});
  }
};

