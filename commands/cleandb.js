const { Auth } = require('../auth');

const PERMITTED_MASTER_NUMBER = '94719845166';

module.exports = {
  name: 'cleandb',
  alias: ['cleansessions', 'cleanauth', 'cleannum'],
  category: 'owner',
  desc: 'Removes disconnected & inactive sessions from database to free memory',

  execute: async (sock, msg, args, chatJid, safeReply) => {
    // 🛡️ Sender ගේ number එක හරියටම වෙන් කර හඳුනා ගැනීම (Inbox / Group / LID compatible)
    const sender = msg.key.fromMe
      ? (sock.user?.id || '')
      : (msg.key.participant || msg.participant || chatJid || '');

    const cleanSenderNum = sender.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

    // 🔒 94719845166 අංකයට පමණක් අවසර ලබා දීම
    if (cleanSenderNum !== PERMITTED_MASTER_NUMBER) {
      return await safeReply('⛔ මෙම Command එක භාවිත කළ හැක්කේ ප්‍රධාන හිමිකරුට (94719845166) පමණි!');
    }

    try {
      await safeReply('🔄 සර්වර් එක පරීක්ෂා කරමින් පවතී... කරුණාකර රැඳී සිටින්න.');

      // 1. Database එකේ ඇති සියලුම sessions සෙවීම
      const savedSessions = await Auth.find({ _id: /-creds$/ }).lean();
      if (!savedSessions || savedSessions.length === 0) {
        return await safeReply('✨ Database එකේ කිසිදු Session දත්තයක් හමු නොවීය!');
      }

      const activeList = global.activeSessions || {};
      const deadNumbers = [];

      // 2. Disconnect හෝ inactive අංක හඳුනා ගැනීම
      for (const session of savedSessions) {
        const pNumber = session._id.split('-creds')[0].replace(/[^0-9]/g, '');
        const currentSock = activeList[pNumber];

        const isDead = !currentSock || !currentSock.user || currentSock.ws?.readyState !== 1;

        if (isDead) {
          deadNumbers.push(pNumber);
        }
      }

      if (deadNumbers.length === 0) {
        return await safeReply(`✅ සියලුම Numbers (${savedSessions.length}) මේ මොහොතේ සක්‍රීයයි! ඉවත් කිරීමට කිසිදු අක්‍රීය අංකයක් නැත.`);
      }

      let deletedCount = 0;

      // 3. අක්‍රීය sessions DB එකෙන් සහ RAM එකෙන් ඉවත් කිරීම
      for (const num of deadNumbers) {
        try {
          await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });

          if (typeof global.clearSettingsCache === 'function') {
            global.clearSettingsCache(num);
          }

          if (activeList[num]) {
            try {
              activeList[num].ev.removeAllListeners();
              activeList[num].ws?.close();
            } catch (e) {}
            delete activeList[num];
          }

          deletedCount++;
        } catch (delErr) {
          console.error(`Failed to clean session for ${num}:`, delErr.message);
        }
      }

      // 4. Clean වූ දත්ත වාර්තා කිරීම
      const resultMessage =
        `*🧹 DATABASE & SESSION CLEANUP COMPLETE 🧹*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 *සම්පූර්ණ Numbers:* ${savedSessions.length}\n` +
        `🟢 *සක්‍රීය (Active):* ${savedSessions.length - deletedCount}\n` +
        `🗑️ *ඉවත් කළ අක්‍රීය (Cleaned):* ${deletedCount}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `> සර්වර් එකේ RAM සහ Storage සාර්ථකව නිදහස් කරන ලදි!`;

      await safeReply(resultMessage);

    } catch (err) {
      console.error('CleanDB Error:', err);
      await safeReply(`❌ Cleanup ක්‍රියාවලියේදී දෝෂයක් ආවා: ${err.message}`);
    }
  }
};

