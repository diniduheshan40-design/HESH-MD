// ============================================================================
// 📦 PACKAGES
// ============================================================================
const express = require('express');
const pino = require('pino');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const fetch = require('node-fetch');
const {
  default: makeWASocket,
  DisconnectReason,
  delay,
  Browsers,
  makeCacheableSignalKeyStore,
  WAMessageStubType
} = require('@whiskeysockets/baileys');

// 🟢 Global Process Crash Guards
process.on('uncaughtException', (err) => {
  console.error('🛡️ Uncaught Exception Guard:', err?.message || err);
});
process.on('unhandledRejection', (err) => {
  console.error('🛡️ Unhandled Rejection Guard:', err?.message || err);
});

// 🟢 Config & DB Models
const { MONGODB_URI, BOT_NAME } = require('./config');
const { useMongoDBAuthState, Auth } = require('./auth');
const { askAI } = require('./ai');

// ============================================================================
// 🌍 GLOBAL CONSTANTS
// ============================================================================

const UPDATE_CHANNEL_JID = '120363421906774107@newsletter';
const BOT_CHANNEL_NAME = '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨';
const CHANNEL_REACTIONS = ['😼', '🥰', '❤️', '😚', '👑', '💯', '👍'];
const DEFAULT_BACKUP_LOGO = 'https://files.catbox.moe/a58add.jpeg';

const channelContext = {
  contextInfo: {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: UPDATE_CHANNEL_JID,
      newsletterName: BOT_CHANNEL_NAME,
      serverMessageId: 1
    }
  }
};
global.channelContext = channelContext;

const REAL_OWNER_NUMBER = '94719845166';
const OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '15947733680169@lid',
  '72787431583987',
  '72787431583987@lid'
];

const DEFAULT_SETTINGS = {
  workMode: 'public',
  autoStatusSeen: true,
  statusReact: true,
  statusReactEmoji: '💐',
  botLogo: DEFAULT_BACKUP_LOGO,
  autoPresence: 'off',
  alwaysOnline: 'off',
  autoChatRead: false,
  aiChatEnabled: false,
  antiDeleteEnabled: true,
  antiDeleteType: 'all',
  antiDeleteDest: 'me',
  securityPin: '1234',
  isFirstConnectDone: false
};

// ============================================================================
// 🧠 RUNTIME STATE & OPTIMIZED MESSAGE STORE
// ============================================================================

const settingsCache = new NodeCache({ stdTTL: 300, checkperiod: 60, maxKeys: 100 });
// Memory leak නැති කිරීමට maxKeys 3000 දක්වා සීමා කර ඇත (Render RAM safe)
const globalMsgStore = new NodeCache({ stdTTL: 7200, checkperiod: 120, maxKeys: 3000 });

const activeSessions = {};
global.activeSessions = activeSessions;
const presenceIntervals = {};
const isStarting = {};
const reconnectAttempts = {};
const commands = new Map();

// ============================================================================
// 🗄️ DATABASE SCHEMA & HELPERS
// ============================================================================

function createSettingsModel() {
  const SettingsSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    workMode: { type: String, default: DEFAULT_SETTINGS.workMode },
    autoStatusSeen: { type: Boolean, default: DEFAULT_SETTINGS.autoStatusSeen },
    statusReact: { type: Boolean, default: DEFAULT_SETTINGS.statusReact },
    statusReactEmoji: { type: String, default: DEFAULT_SETTINGS.statusReactEmoji },
    botLogo: { type: String, default: DEFAULT_SETTINGS.botLogo },
    autoPresence: { type: String, default: DEFAULT_SETTINGS.autoPresence },
    alwaysOnline: { type: String, default: DEFAULT_SETTINGS.alwaysOnline },
    autoChatRead: { type: Boolean, default: DEFAULT_SETTINGS.autoChatRead },
    aiChatEnabled: { type: Boolean, default: DEFAULT_SETTINGS.aiChatEnabled },
    antiDeleteEnabled: { type: Boolean, default: DEFAULT_SETTINGS.antiDeleteEnabled },
    antiDeleteType: { type: String, default: DEFAULT_SETTINGS.antiDeleteType },
    antiDeleteDest: { type: String, default: DEFAULT_SETTINGS.antiDeleteDest },
    securityPin: { type: String, default: DEFAULT_SETTINGS.securityPin },
    isFirstConnectDone: { type: Boolean, default: DEFAULT_SETTINGS.isFirstConnectDone }
  });

  return mongoose.models.BotSettings || mongoose.model('BotSettings', SettingsSchema);
}

const SettingsModel = createSettingsModel();

function clearSettingsCache(num) {
  if (num) settingsCache.del(num);
}
global.clearSettingsCache = clearSettingsCache;

async function getBotSettings(botNum) {
  if (!botNum) return { ...DEFAULT_SETTINGS };
  const cached = settingsCache.get(botNum);
  if (cached) return cached;

  try {
    let settings = await SettingsModel.findById(botNum).lean();
    if (!settings) {
      const created = await SettingsModel.create({ _id: botNum, ...DEFAULT_SETTINGS });
      settings = created.toObject();
    }
    settingsCache.set(botNum, settings);
    return settings;
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}
global.getBotSettings = getBotSettings;

// ============================================================================
// 📂 COMMAND LOADER
// ============================================================================

function registerCommandAliases(cmd, cmdName) {
  if (cmd && cmd.name) commands.set(cmd.name.toLowerCase(), cmd);
  commands.set(cmdName, cmd);

  if (cmd && cmd.alias) {
    if (Array.isArray(cmd.alias)) {
      for (const al of cmd.alias) commands.set(al.toLowerCase(), cmd);
    } else if (typeof cmd.alias === 'string') {
      commands.set(cmd.alias.toLowerCase(), cmd);
    }
  }
}

function loadCommandFile(cmdDir, file) {
  try {
    let cmd = require(path.join(cmdDir, file));
    if (cmd.default) cmd = cmd.default;
    const cmdName = file.replace('.js', '').toLowerCase();
    registerCommandAliases(cmd, cmdName);
  } catch (e) {
    console.error(`❌ Error loading ${file}:`, e.message);
  }
}

function loadAllCommands() {
  const cmdDir = path.join(__dirname, 'commands');
  if (!fs.existsSync(cmdDir)) return;
  const cmdFiles = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));
  for (const file of cmdFiles) {
    loadCommandFile(cmdDir, file);
  }
}

function findCommand(...names) {
  for (const name of names) {
    const cmd = commands.get(name);
    if (cmd) return cmd;
  }
  return null;
}

function getCommandExecutor(cmd) {
  if (typeof cmd === 'function') return cmd;
  if (cmd && typeof cmd.execute === 'function') return cmd.execute;
  if (cmd && typeof cmd.run === 'function') return cmd.run;
  if (cmd && typeof cmd.downloadAndSendStatus === 'function') return cmd.downloadAndSendStatus;
  return null;
}

// ============================================================================
// 🌐 LUXURY RED-BLACK GLASSMORPHIC PORTAL
// ============================================================================

function renderPortalHtml(botName) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover">
      <title>${botName} • PAIRING STATION</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@700;800&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg-core: #090305;
          --panel-bg: rgba(20, 6, 10, 0.72);
          --accent-red: #e11d48;
          --accent-glow: rgba(225, 29, 72, 0.35);
          --crimson-soft: #fb7185;
          --border-glass: rgba(244, 63, 94, 0.22);
          --border-focus: rgba(244, 63, 94, 0.65);
          --text-main: #fcfcfd;
          --text-muted: #9f8e93;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body {
          background-color: var(--bg-core);
          background-image: radial-gradient(circle at 50% 0%, rgba(225, 29, 72, 0.22) 0%, transparent 60%);
          color: var(--text-main);
          font-family: 'Outfit', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100dvh;
          width: 100%;
          padding: 14px;
        }
        .portal-card {
          background: var(--panel-bg);
          backdrop-filter: blur(28px);
          border: 1px solid var(--border-glass);
          border-radius: 28px;
          padding: 34px 30px;
          width: 100%;
          max-width: 440px;
          text-align: center;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
        }
        .app-title { font-size: 26px; font-weight: 800; margin-bottom: 6px; color: #fff; }
        .app-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }
        .phone-input {
          width: 100%; padding: 15px 20px; border-radius: 16px; border: 1px solid var(--border-glass);
          background: rgba(12, 3, 6, 0.7); color: var(--text-main); font-size: 16px; font-weight: 600;
          text-align: center; outline: none; margin-bottom: 14px;
        }
        .btn-action {
          width: 100%; padding: 15px; border-radius: 16px; border: none;
          background: linear-gradient(135deg, #be123c 0%, var(--accent-red) 100%);
          color: #ffffff; font-size: 14px; font-weight: 700; cursor: pointer;
        }
        .code-box {
          font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 800; letter-spacing: 4px;
          color: #ffe4e6; background: rgba(225, 29, 72, 0.14); border: 1.5px dashed rgba(251, 113, 133, 0.45);
          padding: 16px; border-radius: 16px; margin-top: 15px; display: none;
        }
      </style>
    </head>
    <body>
      <div class="portal-card">
        <h1 class="app-title">${botName}</h1>
        <p class="app-desc">Enter phone number with country code</p>
        <input type="text" id="phone" class="phone-input" placeholder="e.g. 9470xxxxxxx" />
        <button id="btn" class="btn-action" onclick="fetchPairCode()">GET PAIRING CODE</button>
        <div class="code-box" id="codeDisplay"></div>
      </div>
      <script>
        async function fetchPairCode() {
          const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
          if (!phone || phone.length < 10) return alert('Enter valid number!');
          const btn = document.getElementById('btn');
          const display = document.getElementById('codeDisplay');
          btn.innerText = 'GENERATING...';
          btn.disabled = true;
          try {
            const res = await fetch('/pair?num=' + phone);
            const data = await res.json();
            if (data.code) {
              display.innerText = data.code;
              display.style.display = 'block';
            } else {
              alert(data.error || 'Retry after a moment');
            }
          } catch(e) {
            alert('Failed to connect to backend.');
          }
          btn.innerText = 'GET PAIRING CODE';
          btn.disabled = false;
        }
      </script>
    </body>
    </html>
  `;
}

function registerPortalRoute(app) {
  app.get('/', (req, res) => {
    res.send(renderPortalHtml(BOT_NAME));
  });
  app.get('/ping', (req, res) => {
    res.status(200).send('PONG_OK');
  });
}

// ============================================================================
// 🔌 SOCKET CREATION
// ============================================================================

async function createBaileysSocket(phoneNumber) {
  const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(phoneNumber);
  const logger = pino({ level: 'silent' });
  const msgRetryCounterCache = new NodeCache({ stdTTL: 180, checkperiod: 60, maxKeys: 300 });

  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    msgRetryCounterCache,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    fireInitQueries: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    markOnlineOnConnect: false,
    emitOwnEvents: false,
    shouldIgnoreJid: () => false
  });

  sock.ev.on('creds.update', saveCreds);
  return { sock, clearSessionData };
}

// ============================================================================
// 🔄 CONNECTION LIFECYCLE
// ============================================================================

async function handleConnectionClose(sock, phoneNumber, lastDisconnect, clearSessionData) {
  const statusCode = lastDisconnect?.error?.output?.statusCode;
  console.log(`⚠️ Connection closed (${phoneNumber}), Code: ${statusCode}`);

  if (presenceIntervals[phoneNumber]) {
    clearInterval(presenceIntervals[phoneNumber]);
    delete presenceIntervals[phoneNumber];
  }

  try {
    sock.ev.removeAllListeners();
    sock.ws?.close();
  } catch (e) {}

  delete activeSessions[phoneNumber];

  if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
    console.log(`❌ Permanent session logout: ${phoneNumber}`);
    delete reconnectAttempts[phoneNumber];
    if (typeof clearSessionData === 'function') await clearSessionData();
    return;
  }

  reconnectAttempts[phoneNumber] = (reconnectAttempts[phoneNumber] || 0) + 1;
  let delayTime = 5000;

  if (statusCode === 440 || statusCode === 428) {
    delayTime = Math.min(reconnectAttempts[phoneNumber] * 10000, 30000);
  }

  setTimeout(() => {
    initWhatsApp(phoneNumber);
  }, delayTime);
}

function startAlwaysOnlinePresenceLoop(sock, phoneNumber) {
  if (presenceIntervals[phoneNumber]) clearInterval(presenceIntervals[phoneNumber]);

  presenceIntervals[phoneNumber] = setInterval(async () => {
    try {
      if (!sock || !sock.user) {
        clearInterval(presenceIntervals[phoneNumber]);
        return;
      }
      const botNum = sock.user.id.split(':')[0].replace(/[^0-9]/g, '');
      const settings = await getBotSettings(botNum);

      if (settings.alwaysOnline === 'on') {
        await sock.sendPresenceUpdate('available');
      }
    } catch (e) {}
  }, 120000); // විනාඩි 2 කට වරක් පමණක් update කර socket spam වීම වළකයි
}

function handleConnectionOpen(sock, phoneNumber) {
  console.log(`✅ BOT CONNECTED: ${phoneNumber}`);
  reconnectAttempts[phoneNumber] = 0;
  startAlwaysOnlinePresenceLoop(sock, phoneNumber);

  const botNum = sock.user?.id ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : phoneNumber.replace(/[^0-9]/g, '');
  getBotSettings(botNum).then(settings => {
    if (settings.alwaysOnline === 'on') {
      sock.sendPresenceUpdate('available').catch(() => {});
    }
  }).catch(() => {});
}

function registerConnectionUpdateHandler(sock, phoneNumber, clearSessionData) {
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      await handleConnectionClose(sock, phoneNumber, lastDisconnect, clearSessionData);
    } else if (connection === 'open') {
      handleConnectionOpen(sock, phoneNumber);
    }
  });
}

// ============================================================================
// 💬 MESSAGE HANDLING HELPERS
// ============================================================================

async function reactToChannelPost(sock, msg, chatJid) {
  try {
    const randomEmoji = CHANNEL_REACTIONS[Math.floor(Math.random() * CHANNEL_REACTIONS.length)];
    const serverId = msg.message?.newsletterAdminInviteMessage?.newsletterJid || msg.key?.server_id || msg.key?.id;
    if (typeof sock.newsletterReactMessage === 'function' && serverId) {
      await sock.newsletterReactMessage(chatJid, serverId, randomEmoji);
    }
  } catch (err) {}
}

function resolveOriginalSender(msg, chatJid, isGroup, myBotJid) {
  if (msg.key.fromMe) return myBotJid;
  if (isGroup) return msg.key?.participant || msg.participant || '';
  return chatJid;
}

function isOwnerJid(jid) {
  if (!jid) return false;
  const str = String(jid).toLowerCase();
  return OWNER_NUMBERS.some(owner => str.includes(owner.toLowerCase()));
}

function checkIsAuthorizedToControl(isOwner, msg, myBotNum, cleanSenderNum) {
  return isOwner || msg.key.fromMe || (Boolean(myBotNum) && cleanSenderNum === myBotNum);
}

function shouldSkipDueToWorkMode(isAuthorized, isGroup, workMode) {
  if (isAuthorized) return false;
  const mode = String(workMode || 'public').toLowerCase().trim();
  if (mode === 'public') return false;
  if (mode === 'private' || mode === 'self') return true;
  if ((mode === 'groups' || mode === 'group') && !isGroup) return true;
  if (mode === 'inbox' && isGroup) return true;
  return false;
}

function unwrapMessageContent(message) {
  return (
    message?.ephemeralMessage?.message ||
    message?.viewOnceMessage?.message ||
    message?.viewOnceMessageV2?.message ||
    message?.documentWithCaptionMessage?.message ||
    message
  );
}

function extractMessageText(rawMsg) {
  return (
    rawMsg?.conversation ||
    rawMsg?.extendedTextMessage?.text ||
    rawMsg?.imageMessage?.caption ||
    rawMsg?.videoMessage?.caption ||
    rawMsg?.buttonsResponseMessage?.selectedButtonId ||
    rawMsg?.templateButtonReplyMessage?.selectedId ||
    ''
  ).trim();
}

function buildSafeReply(sock, chatJid, msg) {
  return async (content) => {
    try {
      let replyPayload = typeof content === 'string' ? { text: content } : { ...content };
      replyPayload.contextInfo = {
        ...(replyPayload.contextInfo || {}),
        ...(global.channelContext?.contextInfo || {})
      };
      return await sock.sendMessage(chatJid, replyPayload, { quoted: msg });
    } catch (e) {
      try {
        let fallbackPayload = typeof content === 'string' ? { text: content } : { ...content };
        return await sock.sendMessage(chatJid, fallbackPayload);
      } catch (err) {
        console.error('SafeReply Error:', err.message);
      }
    }
  };
}

// ============================================================================
// 🛡️ ANTI-DELETE DISPATCHER
// ============================================================================

async function triggerAntiDelete(sock, deletedKey, cachedMsg, phoneNumber) {
  try {
    const myBotJid = sock.user?.id || '';
    const myBotNum = myBotJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || phoneNumber.replace(/[^0-9]/g, '');
    const settings = await getBotSettings(myBotNum);

    if (!settings.antiDeleteEnabled) return;

    const chatJid = deletedKey.remoteJid;
    const isGroup = chatJid.endsWith('@g.us');

    if (settings.antiDeleteType === 'inbox' && isGroup) return;
    if (settings.antiDeleteType === 'group' && !isGroup) return;

    const sender = cachedMsg.key.participant || cachedMsg.key.remoteJid;
    const senderClean = sender.split('@')[0].split(':')[0];

    const targetJid = settings.antiDeleteDest === 'from'
      ? chatJid
      : myBotJid.split(':')[0] + '@s.whatsapp.net';

    const alertText = 
      `*🛡️ ANTI-DELETE DETECTED 🛡️*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Sender:* @${senderClean}\n` +
      `📍 *Chat:* ${isGroup ? 'Group Chat' : 'Inbox'}\n` +
      `⏰ *Time:* ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' })}\n` +
      `━━━━━━━━━━━━━━━━━━━━━`;

    await sock.sendMessage(targetJid, { text: alertText, mentions: [sender], ...global.channelContext });

    const rawContent = unwrapMessageContent(cachedMsg.message);
    const textBody = rawContent?.conversation || rawContent?.extendedTextMessage?.text;

    if (textBody) {
      await sock.sendMessage(targetJid, { text: `💬 *Deleted Text:*\n\n${textBody}` });
    } else {
      await sock.sendMessage(targetJid, { forward: cachedMsg, ...global.channelContext }).catch(() => {});
    }
  } catch (err) {
    console.error('Anti-delete trigger error:', err?.message);
  }
}

// ============================================================================
// 💬 SINGLE MESSAGE PROCESSOR
// ============================================================================

async function processSingleMessage(sock, msg, phoneNumber) {
  try {
    if (!msg || !msg.message) return;
    const chatJid = msg.key?.remoteJid;
    if (!chatJid) return;

    // RAM overflow නොවීමට Text/Essential කොටස් පමණක් cache කිරීම
    if (chatJid !== 'status@broadcast' && msg.key?.id) {
      const isProtocolRevoke = msg.message?.protocolMessage?.type === 0;
      if (isProtocolRevoke && msg.message?.protocolMessage?.key?.id) {
        const revKey = msg.message.protocolMessage.key;
        const cachedRevMsg = globalMsgStore.get(revKey.id);
        if (cachedRevMsg) {
          await triggerAntiDelete(sock, revKey, cachedRevMsg, phoneNumber);
          return;
        }
      }
      globalMsgStore.set(msg.key.id, msg);
    }

    if (chatJid === UPDATE_CHANNEL_JID || chatJid.endsWith('@newsletter')) {
      if (!msg.message.reactionMessage) reactToChannelPost(sock, msg, chatJid);
      return;
    }

    if (msg.message.reactionMessage) return;

    const isGroup = chatJid.endsWith('@g.us');
    const myBotJid = sock.user?.id || '';
    const myBotNum = myBotJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || phoneNumber.replace(/[^0-9]/g, '');
    const settings = await getBotSettings(myBotNum);

    if (chatJid === 'status@broadcast') {
      if (settings.autoStatusSeen) await sock.readMessages([msg.key]).catch(() => {});
      return;
    }

    const originalSender = resolveOriginalSender(msg, chatJid, isGroup, myBotJid);
    const isOwner = isOwnerJid(originalSender);
    const cleanSenderNum = (originalSender || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    const isAuthorized = checkIsAuthorizedToControl(isOwner, msg, myBotNum, cleanSenderNum);
    const currentMode = settings.workMode || 'public';

    const rawMsg = unwrapMessageContent(msg.message);
    const text = extractMessageText(rawMsg);
    if (!text) return;

    const safeReply = buildSafeReply(sock, chatJid, msg);

    // 🎯 PREFIX COMMANDS RUNNER (WITH COMPLETE TRY-CATCH GUARD)
    const prefixMatch = text.match(/^[./!#]/);
    if (prefixMatch) {
      const prefix = prefixMatch[0];
      const args = text.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      if (shouldSkipDueToWorkMode(isAuthorized, isGroup, currentMode)) return;

      const targetCmd = commands.get(commandName) || findCommand(commandName);
      if (targetCmd) {
        try {
          const cmdFunc = getCommandExecutor(targetCmd);
          if (cmdFunc) {
            await cmdFunc(sock, msg, args, chatJid, safeReply, { isOwner: isAuthorized, isGroup });
          }
        } catch (cmdErr) {
          console.error(`❌ Crash avoided in command [${commandName}]:`, cmdErr?.message || cmdErr);
          await safeReply(`⚠️ Command එක execute කිරීමේදී දෝෂයක් ආවා: ${cmdErr?.message || 'Unknown error'}`);
        }
        return;
      }
    }

    // 🎯 AI AUTO CHAT
    if (settings.aiChatEnabled && !msg.key.fromMe) {
      if (!shouldSkipDueToWorkMode(isAuthorized, isGroup, currentMode)) {
        const aiReply = await askAI(text, originalSender || chatJid);
        if (aiReply) await safeReply(aiReply);
      }
    }
  } catch (procErr) {
    console.error('Message Processing Error Guard:', procErr.message);
  }
}

function registerMessageUpsertHandler(sock, phoneNumber) {
  sock.ev.on('messages.upsert', ({ messages }) => {
    if (!messages || !messages.length) return;
    for (const msg of messages) {
      processSingleMessage(sock, msg, phoneNumber).catch(err => {
        console.error('Upsert single message caught error:', err?.message);
      });
    }
  });
}

function registerMessageUpdateHandler(sock, phoneNumber) {
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

        const cachedMsg = globalMsgStore.get(deletedKey.id);
        if (!cachedMsg || !cachedMsg.message) continue;

        await triggerAntiDelete(sock, deletedKey, cachedMsg, phoneNumber);
      } catch (err) {}
    }
  });
}

// ============================================================================
// 🚀 MAIN WHATSAPP INITIALIZER
// ============================================================================

async function initWhatsApp(phoneNumber) {
  if (activeSessions[phoneNumber]) return activeSessions[phoneNumber];
  if (isStarting[phoneNumber]) return;
  isStarting[phoneNumber] = true;

  try {
    const { sock, clearSessionData } = await createBaileysSocket(phoneNumber);
    activeSessions[phoneNumber] = sock;
    delete isStarting[phoneNumber];

    registerConnectionUpdateHandler(sock, phoneNumber, clearSessionData);
    registerMessageUpsertHandler(sock, phoneNumber);
    registerMessageUpdateHandler(sock, phoneNumber);

    return sock;
  } catch (err) {
    delete isStarting[phoneNumber];
    console.error(`initWhatsApp Error (${phoneNumber}):`, err.message);
  }
}

// ============================================================================
// 🌐 HTTP ROUTES
// ============================================================================

function stopAndRemoveSession(num) {
  if (presenceIntervals[num]) {
    clearInterval(presenceIntervals[num]);
    delete presenceIntervals[num];
  }
  if (!activeSessions[num]) return;
  try {
    activeSessions[num].ev.removeAllListeners();
    activeSessions[num].ws?.close();
  } catch (e) {}
  delete activeSessions[num];
}

function registerResetSingleNumberRoute(app) {
  app.get('/reset-num', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number required' });
    num = num.replace(/[^0-9]/g, '');

    try {
      stopAndRemoveSession(num);
      delete isStarting[num];
      await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
      clearSettingsCache(num);
      return res.json({ success: true, message: `Session cleared for ${num}` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
}

function registerPairRoute(app) {
  app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Phone number is required!' });
    num = num.replace(/[^0-9]/g, '');

    stopAndRemoveSession(num);
    delete isStarting[num];

    try {
      await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
      clearSettingsCache(num);
    } catch (e) {}

    let pairSock = null;
    try {
      const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(num);
      const logger = pino({ level: 'silent' });

      pairSock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
      });

      pairSock.ev.on('creds.update', saveCreds);

      pairSock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
          activeSessions[num] = pairSock;
          registerConnectionUpdateHandler(pairSock, num, clearSessionData);
          registerMessageUpsertHandler(pairSock, num);
          registerMessageUpdateHandler(pairSock, num);
          handleConnectionOpen(pairSock, num);
        }
      });

      await delay(3000);

      if (!pairSock.authState.creds.registered) {
        let code = await pairSock.requestPairingCode(num);
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        return res.json({ code });
      } else {
        return res.status(400).json({ error: 'Session already exists. Reset and try again.' });
      }
    } catch (err) {
      if (pairSock) {
        try {
          pairSock.ev.removeAllListeners();
          pairSock.ws?.close();
        } catch (e) {}
      }
      return res.status(500).json({ error: 'Pairing generation failed. Please wait 10s and retry.' });
    }
  });
}

function registerAllHttpRoutes(app) {
  registerPortalRoute(app);
  registerResetSingleNumberRoute(app);
  registerPairRoute(app);
}

// ============================================================================
// 🔁 AUTO KEEP-ALIVE SYSTEM (FIXED FOR RENDER / SELF PING)
// ============================================================================

function startKeepAlivePing(port) {
  // Render එකේ Host URL එක නැතිනම් Localhost එකට ping කරයි
  const targetUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}/ping`;

  setInterval(async () => {
    try {
      await fetch(targetUrl);
      // console.log('Keep-alive ping sent successfully');
    } catch (e) {}
  }, 90000); // තත්පර 90 කට වරක් ping කර සර්වර් එක awake තබයි
}

// ============================================================================
// 🍃 STARTUP
// ============================================================================

async function reconnectAllSavedSessions() {
  try {
    const sessions = await Auth.find({ _id: /-creds$/ }).lean();
    for (const session of sessions) {
      const pNumber = session._id.split('-creds')[0];
      await initWhatsApp(pNumber);
      await delay(5000);
    }
  } catch (e) {
    console.error('Error reconnecting sessions:', e.message);
  }
}

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;
  app.use(express.json());

  loadAllCommands();
  registerAllHttpRoutes(app);

  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    startKeepAlivePing(port);
  });

  await reconnectAllSavedSessions();
}

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('🍃 MongoDB Connected!');
    await startServer();
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
  }
}

main();

