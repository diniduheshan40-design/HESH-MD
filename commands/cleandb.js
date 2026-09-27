// commands/cleandb.js
const mongoose = require('mongoose');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { Auth } = require('../auth');

// 👑 EXCLUSIVE DEVELOPER NUMBER
const PERMITTED_MASTER_NUMBER = '94719845166';

function getSettingsModel() {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    return mongoose.models.BotSettings || mongoose.model('BotSettings');
  } catch (e) {
    return null;
  }
}

module.exports = {
  name: 'cleandb',
  alias: ['cleansessions', 'cleanauth', 'cleannum'],
  category: 'developer',
  desc: 'Removes disconnected & inactive sessions from database to free memory (Developer Only)',

  execute: async (sock, msg, args, chatJid, safeReply) => {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
    };

    // ⚡ 1. SENDER VERIFICATION (Group / Private / LID Support)
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

    // ⛔ 2. STRICT DEVELOPER CHECK
    if (cleanSenderNum !== PERMITTED_MASTER_NUMBER) {
      return await reply('⛔ *Access Denied!* මෙම Command එක භාවිත කළ හැක්කේ ප්‍රධාන Developer හට පමණි (+94719845166).');
    }

    try {
      await reply('🔄 සර්වර් එක පරීක්ෂා කරමින් පවතී... කරුණාකර රැඳී සිටින්න.');

      // 1. Database එකේ ඇති සියලුම creds sessions සෙවීම
      const savedSessions = await Auth.find({ _id: /-creds$/ }).lean();
      if (!savedSessions || savedSessions.length === 0) {
        return await reply('✨ Database එකේ කිසිදු Session දත්තයක් හමු නොවීය!');
      }

      const activeList = global.activeSessions || {};
      const deadNumbers = [];

      // 2. Disconnected හෝ Inactive අංක හඳුනා ගැනීම
      for (const session of savedSessions) {
        const pNumber = session._id.split('-creds')[0].replace(/\D/g, '');
        const currentSock = activeList[pNumber];

        const isDead = !currentSock || !currentSock.user || (currentSock.ws?.readyState !== 1 && currentSock.ws?.socket?.readyState !== 1);

        if (isDead) {
          deadNumbers.push(pNumber);
        }
      }

      if (deadNumbers.length === 0) {
        return await reply(`✅ සියලුම Numbers (${savedSessions.length}) මේ මොහොතේ සක්‍රීයයි! ඉවත් කිරීමට කිසිදු අක්‍රීය අංකයක් නැත.`);
      }

      let deletedCount = 0;
      const SettingsModel = getSettingsModel();

      // 3. අක්‍රීය sessions DB එකෙන් සහ RAM එකෙන් ඉවත් කිරීම
      for (const num of deadNumbers) {
        try {
          await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });

          if (SettingsModel) {
            await SettingsModel.findByIdAndDelete(num).catch(() => {});
          }

          if (typeof global.clearSettingsCache === 'function') {
            global.clearSettingsCache(num);
          }

          if (activeList[num]) {
            try {
              activeList[num].ev.removeAllListeners();
              activeList[num].ws?.removeAllListeners();
              activeList[num].ws?.close();
            } catch (e) {}
            delete activeList[num];
          }

          deletedCount++;
        } catch (delErr) {
          console.error(`Failed to clean session for ${num}:`, delErr?.message);
        }
      }

      // 4. Cleanup ප්‍රතිඵල වාර්තාව
      const resultMessage =
        `*🧹 DATABASE & SESSION CLEANUP COMPLETE 🧹*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 *සම්පූර්ණ Numbers:* ${savedSessions.length}\n` +
        `🟢 *සක්‍රීය (Active):* ${savedSessions.length - deletedCount}\n` +
        `🗑️ *ඉවත් කළ අක්‍රීය (Cleaned):* ${deletedCount}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `> සර්වර් එකේ RAM සහ Storage සාර්ථකව නිදහස් කරන ලදි!`;

      await reply(resultMessage);

    } catch (err) {
      console.error('CleanDB Error:', err);
      await reply(`❌ Cleanup ක්‍රියාවලියේදී දෝෂයක් ආවා: ${err?.message || err}`);
    }
  }
};
