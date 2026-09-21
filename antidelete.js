// commands/antidelete.js
const NodeCache = require('node-cache');
const { WAMessageStubType } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');

// මැසේජ් Cache කර තබා ගැනීමට (පැය 2ක කාලයක්)
const messageCache = new NodeCache({ stdTTL: 7200, checkperiod: 300, maxKeys: 10000 });
let isListenerActive = false;

// DB Model Helper
function getSettingsModel() {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    return mongoose.models.BotSettings || mongoose.model('BotSettings');
  } catch (e) {
    return null;
  }
}

// Background Listener එක Setup කිරීම (එක් වරක් පමණක් run වේ)
function setupAntiDeleteListener(sock) {
  if (isListenerActive) return;
  isListenerActive = true;

  // 1. එන මැසේජ් cache කරගැනීම
  sock.ev.on('messages.upsert', ({ messages }) => {
    if (!messages || !messages.length) return;
    for (const msg of messages) {
      if (msg.key && msg.key.id && msg.key.remoteJid !== 'status@broadcast') {
        messageCache.set(msg.key.id, msg);
      }
    }
  });

  // 2. මැසේජ් එකක් ඩිලීට් (Revoke) වූ විට හසුකර ගැනීම
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      try {
        const isRevoke =
          update.update?.messageStubType === WAMessageStubType.REVOKE ||
          update.update?.messageStubType === 68 ||
          update.update?.message?.protocolMessage?.type === 0;

        if (!isRevoke) continue;

        const deletedKey = update.key;
        if (!deletedKey || !deletedKey.id) continue;

        const cachedMsg = messageCache.get(deletedKey.id);
        if (!cachedMsg || !cachedMsg.message) continue;

        const myBotJid = sock.user?.id || '';
        const myBotNum = myBotJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

        let settings = null;
        if (typeof global.getBotSettings === 'function') {
          settings = await global.getBotSettings(myBotNum);
        } else {
          const Model = getSettingsModel();
          if (Model) settings = await Model.findById(myBotNum).lean();
        }

        if (!settings || !settings.antiDeleteEnabled) continue;

        const chatJid = deletedKey.remoteJid;
        const isGroup = chatJid.endsWith('@g.us');

        // Scope filter
        if (settings.antiDeleteType === 'inbox' && isGroup) continue;
        if (settings.antiDeleteType === 'group' && !isGroup) continue;

        const sender = cachedMsg.key.participant || cachedMsg.key.remoteJid;
        const senderClean = sender.split('@')[0].split(':')[0];

        // Target chat filter
        let targetJid = (settings.antiDeleteDest === 'from') 
          ? chatJid 
          : myBotJid.split(':')[0] + '@s.whatsapp.net';

        const alertText = 
          `*🛡️ ANTI-DELETE DETECTED 🛡️*\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 *Sender:* @${senderClean}\n` +
          `📍 *Chat:* ${isGroup ? 'Group Chat' : 'Inbox (Private)'}\n` +
          `⏰ *Time:* ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' })}\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `> *Deleted Message Content Below:*`;

        // Alert message එක යැවීම
        await sock.sendMessage(targetJid, {
          text: alertText,
          mentions: [sender],
          ...(global.channelContext || {})
        });

        // Delete වූ message එක forward/send කිරීම
        try {
          await sock.sendMessage(targetJid, { forward: cachedMsg, ...(global.channelContext || {}) });
        } catch (e) {
          const actualContent = cachedMsg.message;
          await sock.sendMessage(targetJid, actualContent);
        }

      } catch (err) {
        console.error('Anti-delete processing error:', err?.message);
      }
    }
  });
}

module.exports = {
  name: 'antidelete',
  alias: ['antidel'],
  category: 'owner',
  desc: 'Control anti-delete settings',

  async execute(sock, msg, args = [], chatJid, safeReply, options = {}) {
    // පළමු වතාවට command එක run වෙනකොට listener එක start කරවීම
    setupAntiDeleteListener(sock);

    const targetChat = chatJid || msg.key?.remoteJid;
    const rawBotId = sock.user?.id || '';
    const myBotNum = rawBotId.split(':')[0].split('@')[0].replace(/\D/g, '');

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text }, { quoted: msg });
    };

    if (!options.isOwner && !msg.key.fromMe) {
      return await reply('⚠️ Settings වෙනස් කළ හැක්කේ Bot හිමිකරුට (Owner) පමණි.');
    }

    const sub = args[0]?.toLowerCase();
    const val = args[1]?.toLowerCase();
    const Model = getSettingsModel();

    let current = {};
    if (typeof global.getBotSettings === 'function') {
      current = await global.getBotSettings(myBotNum);
    } else if (Model) {
      current = await Model.findById(myBotNum).lean() || {};
    }

    // Command Menu
    if (!sub) {
      return reply(
        `*🛡️ ANTI-DELETE CONTROLS*\n\n` +
        `• Status   : *${current.antiDeleteEnabled ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• Scope    : *${(current.antiDeleteType || 'all').toUpperCase()}* (inbox | group | all)\n` +
        `• Send To  : *${(current.antiDeleteDest || 'me').toUpperCase()}* (me | from)\n\n` +
        `*Commands:*\n` +
        `• \`.antidel on/off\` - Turn On or Off\n` +
        `• \`.antidel type inbox/group/all\` - Set Scope\n` +
        `• \`.antidel to me/from\` - Set Destination`
      );
    }

    // ON / OFF
    if (sub === 'on' || sub === 'off') {
      const state = sub === 'on';
      if (Model) await Model.findByIdAndUpdate(myBotNum, { antiDeleteEnabled: state }, { upsert: true });
      if (typeof global.clearSettingsCache === 'function') global.clearSettingsCache(myBotNum);
      return reply(`✅ Anti-Delete status updated to: *${sub.toUpperCase()}*`);
    }

    // Type Scope
    if (sub === 'type') {
      if (!['inbox', 'group', 'all'].includes(val)) {
        return reply('❌ Invalid type! Choose: `inbox`, `group`, or `all`');
      }
      if (Model) await Model.findByIdAndUpdate(myBotNum, { antiDeleteType: val }, { upsert: true });
      if (typeof global.clearSettingsCache === 'function') global.clearSettingsCache(myBotNum);
      return reply(`✅ Anti-Delete scope set to: *${val.toUpperCase()}*`);
    }

    // Target Destination
    if (sub === 'to' || sub === 'dest') {
      if (!['me', 'from'].includes(val)) {
        return reply('❌ Invalid destination! Choose: `me` (Bot Inbox) or `from` (Chat where deleted)');
      }
      if (Model) await Model.findByIdAndUpdate(myBotNum, { antiDeleteDest: val }, { upsert: true });
      if (typeof global.clearSettingsCache === 'function') global.clearSettingsCache(myBotNum);
      return reply(`✅ Deleted messages will be forwarded to: *${val.toUpperCase()}*`);
    }

    return reply('❌ Invalid argument. Type `.antidel` for help.');
  }
};

