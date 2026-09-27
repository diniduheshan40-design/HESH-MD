// commands/logout.js
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');
const { Auth } = require('../auth');

// 👑 EXCLUSIVE DEVELOPER NUMBER
const DEVELOPER_NUMBER = '94719845166';

function getSettingsModel() {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    return mongoose.models.BotSettings || mongoose.model('BotSettings');
  } catch (e) {
    return null;
  }
}

module.exports = {
  name: 'logout',
  alias: ['delsession', 'stopbot', 'killsession'],
  category: 'developer',
  desc: 'Permanently remove this session from database and system (Developer Only)',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
    };

    // ⚡ 1. SENDER RESOLVER (Group / Private / LID Support)
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
    if (cleanSenderNum !== DEVELOPER_NUMBER) {
      return await reply('⛔ *Access Denied!* මෙම Command එක භාවිත කළ හැක්කේ ප්‍රධාන Developer හට පමණි (+94719845166).');
    }

    // 3. Bot Number හඳුනා ගැනීම
    const myBotJid = jidNormalizedUser(sock.user?.id || '');
    const botNumber = myBotJid.replace(/\D/g, '');

    if (!botNumber) {
      return await reply('❌ Bot ID හඳුනාගත නොහැකි විය!');
    }

    await reply(
      `⚠️ *DEVELOPER SESSION PURGE INITIATED*\n\n` +
      `• *Target Bot*  : +${botNumber}\n` +
      `• *Authorized*  : Root Developer (+${DEVELOPER_NUMBER})\n` +
      `• සියලුම Auth Keys සහ Database Settings ස්ථිරවම මකා දමයි.\n` +
      `• තත්පර 3කින් Session එක Disconnect වේ.`
    );

    setTimeout(async () => {
      try {
        // Database එකෙන් Auth data සහ Settings මකා දැමීම
        await Auth.deleteMany({ _id: new RegExp('^' + botNumber, 'i') }).catch(() => {});

        const SettingsModel = getSettingsModel();
        if (SettingsModel) {
          await SettingsModel.findByIdAndDelete(botNumber).catch(() => {});
        }

        if (typeof global.clearSettingsCache === 'function') {
          global.clearSettingsCache(botNumber);
        }

        // RAM එකෙන් session reference ඉවත් කිරීම
        if (global.activeSessions && global.activeSessions[botNumber]) {
          delete global.activeSessions[botNumber];
        }

        // WhatsApp Session Logout සහ Socket Close
        try {
          await sock.logout();
        } catch (e) {
          try {
            sock.ev.removeAllListeners();
            sock.ws?.removeAllListeners();
            sock.ws?.close();
          } catch (err) {}
        }

        console.log(`🗑️ [Developer] Successfully purged session: +${botNumber}`);
      } catch (err) {
        console.error('Developer Logout Execution Error:', err?.message || err);
      }
    }, 3000);
  }
};
