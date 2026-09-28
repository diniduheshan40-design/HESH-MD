// commands/antidelete.js
const NodeCache = require('node-cache');
const { WAMessageStubType, downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');
const mongoose = require('mongoose');

const messageCache = new NodeCache({ stdTTL: 7200, checkperiod: 300, maxKeys: 15000 });
const registeredSockets = new WeakSet();

// 👑 Developer & Owner ID/LID Bypass List
const DEVELOPER_IDS = ['94719845166', '15947733680169', '94720882316', '72787431583987'];

function getSettingsModel() {
  try {
    if (mongoose.connection.readyState !== 1) return null;
    return mongoose.models.BotSettings || mongoose.model('BotSettings');
  } catch (e) {
    return null;
  }
}

function unwrapMessageContent(message) {
  if (!message) return null;
  return (
    message?.ephemeralMessage?.message ||
    message?.viewOnceMessage?.message ||
    message?.viewOnceMessageV2?.message ||
    message?.viewOnceMessageV2Extension?.message ||
    message?.documentWithCaptionMessage?.message ||
    message
  );
}

async function streamToBuffer(stream) {
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  return buffer;
}

// 📦 Deleted Media Download & Send Helper
async function forwardDeletedMedia(sock, targetJid, rawContent, alertText, sender) {
  const channelInfo = global.channelContext || {};

  try {
    // 1. Text Message
    if (rawContent.conversation || rawContent.extendedTextMessage) {
      const text = rawContent.conversation || rawContent.extendedTextMessage.text || '';
      return await sock.sendMessage(targetJid, {
        text: `${alertText}\n\n💬 *Deleted Text:*\n${text}`,
        mentions: [sender],
        ...channelInfo
      });
    }

    // 2. Image Message
    if (rawContent.imageMessage) {
      const stream = await downloadContentFromMessage(rawContent.imageMessage, 'image');
      const buffer = await streamToBuffer(stream);
      return await sock.sendMessage(targetJid, {
        image: buffer,
        caption: `${alertText}\n\n🖼️ *Caption:* ${rawContent.imageMessage.caption || 'None'}`,
        mentions: [sender],
        ...channelInfo
      });
    }

    // 3. Video Message
    if (rawContent.videoMessage) {
      const stream = await downloadContentFromMessage(rawContent.videoMessage, 'video');
      const buffer = await streamToBuffer(stream);
      return await sock.sendMessage(targetJid, {
        video: buffer,
        caption: `${alertText}\n\n🎥 *Caption:* ${rawContent.videoMessage.caption || 'None'}`,
        mentions: [sender],
        ...channelInfo
      });
    }

    // 4. Audio Message
    if (rawContent.audioMessage) {
      const stream = await downloadContentFromMessage(rawContent.audioMessage, 'audio');
      const buffer = await streamToBuffer(stream);
      await sock.sendMessage(targetJid, { text: alertText, mentions: [sender], ...channelInfo });
      return await sock.sendMessage(targetJid, {
        audio: buffer,
        mimetype: rawContent.audioMessage.mimetype || 'audio/mp4',
        ptt: Boolean(rawContent.audioMessage.ptt)
      });
    }

    // 5. Sticker Message
    if (rawContent.stickerMessage) {
      const stream = await downloadContentFromMessage(rawContent.stickerMessage, 'sticker');
      const buffer = await streamToBuffer(stream);
      await sock.sendMessage(targetJid, { text: alertText, mentions: [sender], ...channelInfo });
      return await sock.sendMessage(targetJid, { sticker: buffer });
    }

    // 6. Other / Document Fallback
    return await sock.sendMessage(targetJid, {
      text: `${alertText}\n\n⚠️ *(Document හෝ හඳුනා නොගත් Media එකක් Delete කර ඇත)*`,
      mentions: [sender],
      ...channelInfo
    });
  } catch (e) {
    console.error('Deleted Media Forwarding Error:', e?.message || e);
  }
}

// 🛡️ Baileys Event Listener for Real-Time Anti-Delete
function setupAntiDeleteListener(sock) {
  if (!sock || !sock.ev || registeredSockets.has(sock)) return;
  registeredSockets.add(sock);

  // Message Caching
  sock.ev.on('messages.upsert', ({ messages }) => {
    if (!messages || !messages.length) return;
    for (const msg of messages) {
      if (msg.key && msg.key.id && msg.key.remoteJid !== 'status@broadcast') {
        messageCache.set(msg.key.id, msg);
      }
    }
  });

  // Catch Revoke / Deleted Message
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      try {
        const isRevoke =
          update.update?.messageStubType === WAMessageStubType.REVOKE ||
          update.update?.messageStubType === 68 ||
          update.update?.message?.protocolMessage?.type === 0 ||
          update.update?.message?.protocolMessage?.type === 'REVOKE';

        if (!isRevoke) continue;

        const deletedKey = update.key;
        if (!deletedKey || !deletedKey.id) continue;

        const cachedMsg = messageCache.get(deletedKey.id);
        if (!cachedMsg || !cachedMsg.message) continue;

        const myBotJid = jidNormalizedUser(sock.user?.id || '');
        const myBotNum = myBotJid.replace(/\D/g, '');

        const Model = getSettingsModel();
        let settings = null;
        if (typeof global.getBotSettings === 'function') {
          settings = await global.getBotSettings(myBotNum);
        } else if (Model) {
          settings = await Model.findById(myBotNum).lean();
        }

        if (!settings || !settings.antiDeleteEnabled) continue;

        const chatJid = deletedKey.remoteJid;
        const isGroup = chatJid.endsWith('@g.us');

        if (settings.antiDeleteType === 'inbox' && isGroup) continue;
        if (settings.antiDeleteType === 'group' && !isGroup) continue;

        const sender = cachedMsg.key.participant || cachedMsg.participant || cachedMsg.key.remoteJid;
        const senderClean = sender.split('@')[0].split(':')[0];

        const targetJid = (settings.antiDeleteDest === 'from') 
          ? chatJid 
          : `${myBotNum}@s.whatsapp.net`;

        const alertText = 
          `*🛡️ ANTI-DELETE DETECTED 🛡️*\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 *Sender:* @${senderClean}\n` +
          `📍 *Chat:* ${isGroup ? 'Group Chat' : 'Inbox (Private)'}\n` +
          `⏰ *Time:* ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' })}\n` +
          `━━━━━━━━━━━━━━━━━━━━━`;

        const rawContent = unwrapMessageContent(cachedMsg.message);
        if (rawContent) {
          await forwardDeletedMedia(sock, targetJid, rawContent, alertText, sender);
        }

      } catch (err) {
        console.error('Anti-delete processing error:', err?.message || err);
      }
    }
  });
}

module.exports = {
  name: 'antidelete',
  alias: ['antidel', 'antid'],
  category: 'owner',
  init: setupAntiDeleteListener,

  async execute(sock, msg, args = [], chatJid, safeReply, options = {}) {
    setupAntiDeleteListener(sock);

    const targetChat = chatJid || msg.key?.remoteJid;
    const myBotJid = jidNormalizedUser(sock.user?.id || '');
    const myBotNum = myBotJid.replace(/\D/g, '');

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text }, { quoted: msg });
    };

    // 🛡️ Owner & Developer Verification (Phone + LID check)
    const sender = msg.key?.participant || msg.participant || targetChat;
    const cleanSender = sender.replace(/\D/g, '');
    const isDev = DEVELOPER_IDS.some(id => cleanSender.includes(id) || sender.includes(id));

    if (!options.isOwner && !msg.key.fromMe && !isDev) {
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

    if (!sub) {
      return reply(
        `*🛡️ ANTI-DELETE CONTROLS*\n\n` +
        `• Status   : *${current.antiDeleteEnabled ? 'ON 🟢' : 'OFF 🔴'}*\n` +
        `• Scope    : *${(current.antiDeleteType || 'all').toUpperCase()}* (inbox | group | all)\n` +
        `• Send To  : *${(current.antiDeleteDest || 'me').toUpperCase()}* (me | from)\n\n` +
        `*Commands:*\n` +
        `• \`.antidel on\` හෝ \`.antidel off\`\n` +
        `• \`.antidel type inbox/group/all\`\n` +
        `• \`.antidel to me/from\``
      );
    }

    if (sub === 'on' || sub === 'off') {
      const state = sub === 'on';
      if (Model) await Model.findByIdAndUpdate(myBotNum, { antiDeleteEnabled: state }, { upsert: true });
      if (typeof global.clearSettingsCache === 'function') global.clearSettingsCache(myBotNum);
      return reply(`✅ Anti-Delete තත්ත්වය *${sub.toUpperCase()}* කරන ලදී.`);
    }

    if (sub === 'type') {
      if (!['inbox', 'group', 'all'].includes(val)) {
        return reply('❌ වලංගු නොවන Type එකක්! තෝරන්න: `inbox`, `group`, හෝ `all`');
      }
      if (Model) await Model.findByIdAndUpdate(myBotNum, { antiDeleteType: val }, { upsert: true });
      if (typeof global.clearSettingsCache === 'function') global.clearSettingsCache(myBotNum);
      return reply(`✅ Anti-Delete scope එක *${val.toUpperCase()}* ලෙස සකසන ලදී.`);
    }

    if (sub === 'to' || sub === 'dest') {
      if (!['me', 'from'].includes(val)) {
        return reply('❌ තෝරන්න: `me` (Bot Inbox) හෝ `from` (මැකූ Chat එකටම)');
      }
      if (Model) await Model.findByIdAndUpdate(myBotNum, { antiDeleteDest: val }, { upsert: true });
      if (typeof global.clearSettingsCache === 'function') global.clearSettingsCache(myBotNum);
      return reply(`✅ මැකූ පණිවිඩ යැවෙන ස්ථානය *${val.toUpperCase()}* ලෙස සකසන ලදී.`);
    }

    return reply('❌ වැරදි command එකක්. උදවු සඳහා `.antidel` ලබා දෙන්න.');
  }
};
