// commands/cleandb.js
const mongoose = require('mongoose');

const MASTER_OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '72787431583987'
];

module.exports = {
  name: 'check',
  alias: ['chek', 'cleandead', 'autoclean', 'sessioncheck'],
  category: 'owner',
  desc: 'Check specific bot status or purge all dead/disconnected bot sessions',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    // ⚡ Master Owner Authentication
    const rawParticipant = msg.key?.participant || msg.participant || targetChat || '';
    const cleanSender = rawParticipant.replace(/[^0-9]/g, '');

    const isMasterOwner = Boolean(
      MASTER_OWNER_NUMBERS.some(owner => cleanSender.includes(owner) || rawParticipant.includes(owner)) ||
      msg.key?.fromMe ||
      options?.isOwner
    );

    if (!isMasterOwner) {
      return await sock.sendMessage(targetChat, { 
        text: '⛔ *Access Denied!* මෙම Command එක ක්‍රියාත්මක කළ හැක්කේ Master Owner හට පමණි.' 
      }, { quoted: msg });
    }

    const rawText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    const commandName = rawText.slice(1).split(' ')[0].toLowerCase();
    const activeSessions = global.activeSessions || {};

    // =========================================================================
    // 🔍 1. COMMAND: .check <number> (Check Specific Session)
    // =========================================================================
    if (commandName === 'check' || commandName === 'chek') {
      const inputNumber = (Array.isArray(args) ? args.join('') : String(args || '')).replace(/[^0-9]/g, '');

      if (!inputNumber || inputNumber.length < 9) {
        return await sock.sendMessage(targetChat, {
          text: `╭───❮ 🔎 *SESSION CHECKER* ❯───╮
│
│ ⚠️ *කරුණාකර Phone Number එකක් ඇතුළත් කරන්න!*
│ 💡 *උදාහරණ:* \`.check 9471xxxxxxx\`
│
╰──────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`
        }, { quoted: msg });
      }

      sock.sendMessage(targetChat, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      // Database Auth Collection එකෙන් check කිරීම
      let hasDbSession = false;
      try {
        if (mongoose.connection.db) {
          const count = await mongoose.connection.db.collection('auths').countDocuments({ _id: new RegExp('^' + inputNumber, 'i') });
          hasDbSession = count > 0;
        }
      } catch (e) {}

      // Real-time Socket status එක බැලීම
      const s = activeSessions[inputNumber];
      const isWsOpen = s?.ws?.readyState === 1 || s?.ws?.socket?.readyState === 1;
      const isUserLoaded = Boolean(s?.user?.id);
      const isLive = Boolean(s && isWsOpen && isUserLoaded);

      let statusDescription = '🔴 Disconnected / Inactive';
      if (isLive) {
        statusDescription = '🟢 Live & Online (Running)';
      } else if (hasDbSession) {
        statusDescription = '🟡 Offline / Broken Session (Saved in DB)';
      } else {
        statusDescription = '⚪ No Session Found (Not Registered)';
      }

      const resultText = `╭───❮ 🔎 *BOT SESSION STATUS* ❯───╮
│
├ 📱 *Target Number :* +${inputNumber}
├ 🗄️ *Database Save  :* ${hasDbSession ? '✅ Found' : '❌ Not Found'}
├ ⚡ *Connection     :* ${statusDescription}
│
╰────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

      return await sock.sendMessage(targetChat, {
        text: resultText,
        contextInfo: global.channelContext?.contextInfo || {}
      }, { quoted: msg });
    }

    // =========================================================================
    // 🧹 2. COMMAND: .cleandead (Purge All Dead Sessions & Keep Live Bots)
    // =========================================================================
    if (commandName === 'cleandead' || commandName === 'autoclean') {
      sock.sendMessage(targetChat, { react: { text: "🧹", key: msg.key } }).catch(() => {});

      let waitMsg = await sock.sendMessage(targetChat, {
        text: '⏳ *Live නොවූ සහ Disconnect වූ Sessions සොයමින් ඉවත් කරමින් පවතී...*'
      }, { quoted: msg }).catch(() => null);

      try {
        // 1. Database එකේ තියෙන සියලුම sessions ගමු
        let allDbCreds = [];
        if (mongoose.connection.db) {
          const docs = await mongoose.connection.db.collection('auths').find({ _id: /-creds$/ }).toArray();
          allDbCreds = docs.map(d => d._id.split('-creds')[0]);
        }

        let purgedCount = 0;
        let protectedLiveCount = 0;

        // 2. Active සහ Dead වෙන් කර dead අයව clean කිරීම
        for (const botNum of allDbCreds) {
          const s = activeSessions[botNum];
          const isWsOpen = s?.ws?.readyState === 1 || s?.ws?.socket?.readyState === 1;
          const isLive = Boolean(s && isWsOpen && s?.user?.id);

          if (isLive) {
            // Live ඉන්න අය ආරක්ෂා කරමු
            protectedLiveCount++;
          } else {
            // Dead / Broken අයව Database එකෙන් සහ memory එකෙන් Delete කරමු
            if (activeSessions[botNum]) {
              try {
                activeSessions[botNum].ev.removeAllListeners();
                activeSessions[botNum].ws?.close();
              } catch (err) {}
              delete activeSessions[botNum];
            }

            if (mongoose.connection.db) {
              await mongoose.connection.db.collection('auths').deleteMany({ _id: new RegExp('^' + botNum, 'i') });
            }

            // Bot settings cache එකත් clear කරමු
            if (typeof global.clearSettingsCache === 'function') {
              global.clearSettingsCache(botNum);
            }

            purgedCount++;
          }
        }

        if (waitMsg?.key) {
          await sock.sendMessage(targetChat, { delete: waitMsg.key }).catch(() => {});
        }

        const report = `╭───❮ 🧹 *CLEANUP COMPLETED* ❯───╮
│
├ 🟢 *Protected Live Bots :* ${protectedLiveCount} Bots (Unchanged)
├ 🗑️ *Purged Dead Sessions :* ${purgedCount} Slots (Removed)
├ 🗄️ *Database Status      :* Optimized & Clean
│
╰────────────────────────────────╯
> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`.trim();

        await sock.sendMessage(targetChat, {
          text: report,
          contextInfo: global.channelContext?.contextInfo || {}
        }, { quoted: msg });

        sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      } catch (err) {
        console.error('Cleandead error:', err.message);
        if (waitMsg?.key) sock.sendMessage(targetChat, { delete: waitMsg.key }).catch(() => {});
        await sock.sendMessage(targetChat, { text: `❌ *Error:* ${err.message}` }, { quoted: msg });
      }
    }
  }
};
