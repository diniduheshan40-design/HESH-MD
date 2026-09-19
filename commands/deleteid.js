// commands/deleteid.js
const mongoose = require('mongoose');
const { Auth } = require('../auth');

const REAL_OWNER_NUMBER = '94719845166';

module.exports = {
  name: 'deleteid',
  alias: ['delsession', 'clearnum', 'killsession'],
  category: 'owner',
  desc: 'Kill and delete a bot session by phone number',

  async execute(sock, msg, args, chatJid) {
    const targetChat = chatJid || msg.key.remoteJid;

    // Sender හඳුනා ගැනීම
    const sender = msg.key.participant || msg.participant || targetChat;
    const cleanSender = String(sender).split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

    // 🔒 Real Owner Only Check (ඔයාගේ නම්බර් එකට පමණයි මේක කරන්න පුළුවන්)
    if (!cleanSender.includes(REAL_OWNER_NUMBER) && !msg.key.fromMe) {
      return await sock.sendMessage(targetChat, { 
        text: '⛔ *Access Denied!* මෙම command එක run කළ හැක්කේ ප්‍රධාන Owner හට පමණි.' 
      }, { quoted: msg }).catch(() => {});
    }

    let targetNum = args[0] ? args[0].replace(/[^0-9]/g, '') : '';

    if (!targetNum || targetNum.length < 9) {
      return await sock.sendMessage(targetChat, {
        text: `⚠️ *කරුණාකර Delete කිරීමට අවශ්‍ය Bot Number එක ලබාදෙන්න!*\n\n*උදාහරණයක්:* \`.deleteid 94728482142\``
      }, { quoted: msg }).catch(() => {});
    }

    sock.sendMessage(targetChat, { react: { text: "⏳", key: msg.key } }).catch(() => {});

    try {
      // 1. Active Socket එක Close කර Active Sessions වලින් අයින් කිරීම
      if (global.activeSessions && global.activeSessions[targetNum]) {
        try {
          global.activeSessions[targetNum].ev.removeAllListeners();
          global.activeSessions[targetNum].ws?.close();
        } catch (e) {}
        delete global.activeSessions[targetNum];
      }

      // 2. Settings Cache Clear කිරීම
      if (typeof global.clearSettingsCache === 'function') {
        global.clearSettingsCache(targetNum);
      }

      // 3. MongoDB එකෙන් Session Keys සහ Credentials මකා දැමීම
      let deletedCount = 0;
      if (Auth) {
        const res = await Auth.deleteMany({ _id: new RegExp('^' + targetNum, 'i') });
        deletedCount = res.deletedCount || 0;
      } else if (mongoose.connection.db) {
        const res = await mongoose.connection.db.collection('auths').deleteMany({ _id: new RegExp('^' + targetNum, 'i') });
        deletedCount = res.deletedCount || 0;
      }

      // Settings record එකත් clean කිරීම
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection('botsettings').deleteOne({ _id: targetNum }).catch(() => {});
      }

      sock.sendMessage(targetChat, { react: { text: "✅", key: msg.key } }).catch(() => {});

      return await sock.sendMessage(targetChat, {
        text: `✅ *SESSION DELETED SUCCESSFULLY!*\n\n` +
              `📱 *Target Number:* +${targetNum}\n` +
              `🗑️ *Removed Keys:* ${deletedCount}\n` +
              `🔌 *Status:* Session killed & completely removed from DB.\n\n` +
              `> ⚡ *ʜᴇꜱʜᴀɴ ᴏꜰᴄ • ᴀʟʟ ʀɪɢʜᴛꜱ ʀᴇꜱᴇʀᴠᴇᴅ* ⚡`
      }, { quoted: msg });

    } catch (err) {
      console.error('DeleteID Command Error:', err.message);
      sock.sendMessage(targetChat, { react: { text: "❌", key: msg.key } }).catch(() => {});
      return await sock.sendMessage(targetChat, {
        text: `❌ *Error:* Session එක delete කිරීමට නොහැකි විය.\n*Reason:* ${err.message}`
      }, { quoted: msg });
    }
  }
};

