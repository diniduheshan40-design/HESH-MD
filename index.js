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
const axios = require('axios');
const {
  default: makeWASocket,
  DisconnectReason,
  delay,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  jidNormalizedUser
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

// ============================================================================
// 🌍 GLOBAL CONSTANTS
// ============================================================================

const UPDATE_CHANNEL_JID = '120363421906774107@newsletter';
const BOT_CHANNEL_NAME = '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨';
const CHANNEL_REACTIONS = ['🥰', '👍', '❤️', '😗', '😯', '🪄', '✨'];
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
global.songSessions = global.songSessions || new Map();

// 👑 MASTER DEVELOPER & OWNERS
const REAL_OWNER_NUMBER = '94719845166';
const DEVELOPER_NUMBER = '94719845166';
const OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '72787431583987'
];
global.owner = OWNER_NUMBERS;

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
// 🧠 RUNTIME STATE & IN-MEMORY MESSAGE STORE
// ============================================================================

const settingsCache = new NodeCache({ stdTTL: 300, checkperiod: 60, maxKeys: 300 });
const activeSessions = {};
global.activeSessions = activeSessions;
const isStarting = {};
const reconnectAttempts = {};
const commands = new Map();
const messageVault = new NodeCache({ stdTTL: 86400, checkperiod: 600, maxKeys: 3000 });

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
  if (num) {
    const clean = num.replace(/\D/g, '');
    settingsCache.del(clean);
  }
}
global.clearSettingsCache = clearSettingsCache;

async function getBotSettings(botNum) {
  if (!botNum) return { ...DEFAULT_SETTINGS };
  const cleanNum = botNum.replace(/\D/g, '');
  const cached = settingsCache.get(cleanNum);
  if (cached) return cached;

  try {
    let settings = await SettingsModel.findById(cleanNum).lean();
    if (!settings) {
      const created = await SettingsModel.create({ _id: cleanNum, ...DEFAULT_SETTINGS });
      settings = created.toObject();
    }
    settingsCache.set(cleanNum, settings);
    return settings;
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

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
    delete require.cache[require.resolve(path.join(cmdDir, file))];
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
  console.log(`📦 Loaded ${commands.size} commands & aliases.`);
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
// 🌐 CYBER RED-BLACK GLASSMORPHIC PORTAL
// ============================================================================

function renderPortalHtml(botName) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${botName} • PAIRING STATION</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=JetBrains+Mono:wght@700;800&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg-black: #060203;
          --panel-card: rgba(18, 5, 8, 0.82);
          --neon-red: #ff003c;
          --deep-red: #990024;
          --crimson-glow: rgba(255, 0, 60, 0.45);
          --card-border: rgba(255, 0, 60, 0.32);
          --input-bg: rgba(10, 2, 4, 0.88);
          --text-bright: #ffffff;
          --text-dim: #a89498;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: var(--bg-black);
          background-image: 
            radial-gradient(circle at 50% 0%, rgba(255, 0, 60, 0.25) 0%, transparent 60%),
            radial-gradient(circle at 100% 100%, rgba(153, 0, 36, 0.2) 0%, transparent 50%);
          color: var(--text-bright);
          font-family: 'Outfit', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .portal-container { width: 100%; max-width: 430px; position: relative; }
        .portal-card {
          background: var(--panel-card);
          backdrop-filter: blur(30px);
          border: 1px solid var(--card-border);
          border-radius: 28px;
          padding: 44px 32px;
          text-align: center;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9), 0 0 35px rgba(255, 0, 60, 0.25);
        }
        .brand-title {
          font-size: 32px; font-weight: 900; text-transform: uppercase;
          background: linear-gradient(135deg, #ffffff 30%, #ff8097 70%, var(--neon-red) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin-bottom: 6px;
        }
        .brand-subtitle { color: var(--text-dim); font-size: 13.5px; margin-bottom: 30px; }
        .phone-field {
          width: 100%; padding: 18px 22px; background: var(--input-bg);
          border: 1.5px solid var(--card-border); border-radius: 18px;
          color: #ffffff; font-size: 18px; font-weight: 700; text-align: center;
          outline: none; margin-bottom: 20px; transition: 0.3s;
        }
        .phone-field:focus { border-color: var(--neon-red); box-shadow: 0 0 25px rgba(255, 0, 60, 0.4); }
        .btn-generate {
          width: 100%; padding: 18px; border: none; border-radius: 18px;
          background: linear-gradient(135deg, var(--deep-red) 0%, var(--neon-red) 100%);
          color: #fff; font-size: 15px; font-weight: 800; cursor: pointer; text-transform: uppercase;
        }
        .code-panel { display: none; margin-top: 25px; }
        .code-display {
          font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 800;
          letter-spacing: 5px; color: #fff; background: rgba(255, 0, 60, 0.15);
          border: 2px dashed rgba(255, 0, 60, 0.6); border-radius: 18px; padding: 18px;
        }
      </style>
    </head>
    <body>
      <div class="portal-container">
        <div class="portal-card">
          <h1 class="brand-title">${botName}</h1>
          <p class="brand-subtitle">Enter WhatsApp Number with Country Code</p>
          <input type="tel" id="phone" class="phone-field" placeholder="e.g. 9471xxxxxxx" autofocus />
          <button id="genBtn" class="btn-generate" onclick="generatePairCode()">GENERATE PAIR CODE</button>
          <div class="code-panel" id="codePanel">
            <div class="code-display" id="codeDisplay"></div>
          </div>
        </div>
      </div>
      <script>
        async function generatePairCode() {
          const phoneInput = document.getElementById('phone');
          const cleanPhone = phoneInput.value.replace(/[^0-9]/g, '');
          if (!cleanPhone || cleanPhone.length < 10) return alert('කරුණාකර නිවැරදි අංකය ලබාදෙන්න!');
          const btn = document.getElementById('genBtn');
          btn.innerText = 'GENERATING...';
          btn.disabled = true;
          try {
            const res = await fetch('/pair?num=' + cleanPhone);
            const data = await res.json();
            if (data.code) {
              document.getElementById('codeDisplay').innerText = data.code;
              document.getElementById('codePanel').style.display = 'block';
              if (navigator.clipboard) navigator.clipboard.writeText(data.code).catch(()=>{});
            } else { alert(data.error || 'Connection rate-limited.'); }
          } catch(e) { alert('Server error!'); }
          finally { btn.innerText = 'GENERATE PAIR CODE'; btn.disabled = false; }
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
}

// ============================================================================
// 🔌 SOCKET CREATION
// ============================================================================

async function createBaileysSocket(phoneNumber) {
  const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(phoneNumber);
  const logger = pino({ level: 'silent' });
  const msgRetryCounterCache = new NodeCache({ stdTTL: 180, checkperiod: 60, maxKeys: 300 });
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    printQRInTerminal: false,
    browser: Browsers.macOS('Desktop'),
    msgRetryCounterCache,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    fireInitQueries: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    markOnlineOnConnect: false,
    emitOwnEvents: false,
    shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') && jid !== 'status@broadcast'
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

  try {
    sock.ev.removeAllListeners();
    sock.ws?.removeAllListeners();
    sock.ws?.close();
  } catch (e) {}

  delete activeSessions[phoneNumber];

  if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
    console.log(`❌ Permanent session logout: ${phoneNumber}`);
    delete reconnectAttempts[phoneNumber];
    if (typeof clearSessionData === 'function') await clearSessionData();
    return;
  }

  if (isStarting[phoneNumber]) return;

  reconnectAttempts[phoneNumber] = (reconnectAttempts[phoneNumber] || 0) + 1;
  let delayTime = 7000;

  if (statusCode === 440) {
    delayTime = 15000;
  } else if (reconnectAttempts[phoneNumber] > 5) {
    delayTime = 30000;
  }

  setTimeout(() => {
    initWhatsApp(phoneNumber);
  }, delayTime);
}

async function autoFollowChannelAndJoinGroup(sock) {
  await delay(2500);
  try {
    const inviteCode = '0029VbAQYhXDZ4Lfo9K5gh1V';
    if (typeof sock.newsletterMetadata === 'function' && typeof sock.newsletterFollow === 'function') {
      const channelMeta = await sock.newsletterMetadata('invite', inviteCode);
      if (channelMeta?.id) await sock.newsletterFollow(channelMeta.id);
    }
  } catch (e) {}
}

function buildConnectedMessage(botNum) {
  return `*✦ ${BOT_NAME} CONNECTED ✦*
━━━━━━━━━━━━━━━━━━━━━
• *Number*    : +${botNum}
• *Engine*    : HESHAN-MD V2.1
• *Features*  : Auto Status | Anti-Delete | Fast DL
• *State*     : Online (24/7 Cloud)
━━━━━━━━━━━━━━━━━━━━━
> Type *.menu* to explore all commands.`.trim();
}

async function sendFirstConnectAlerts(sock, phoneNumber) {
  try {
    const botNum = sock.user?.id
      ? jidNormalizedUser(sock.user.id).replace(/\D/g, '')
      : phoneNumber.replace(/\D/g, '');

    const botJid = `${botNum}@s.whatsapp.net`;
    const creatorJid = `${REAL_OWNER_NUMBER}@s.whatsapp.net`;

    const currentSettings = await getBotSettings(botNum);
    if (currentSettings.isFirstConnectDone) return;

    const sessionLogo = currentSettings.botLogo || DEFAULT_BACKUP_LOGO;
    const connectedMsg = buildConnectedMessage(botNum);

    await sock.sendMessage(botJid, {
      image: { url: sessionLogo },
      caption: connectedMsg,
      ...global.channelContext
    }).catch(() => {
      sock.sendMessage(botJid, { text: connectedMsg, ...global.channelContext }).catch(() => {});
    });

    if (!botNum.includes(REAL_OWNER_NUMBER)) {
      const alertMsg = `*🔔 ALERT : NEW SESSION CONNECTED*\n━━━━━━━━━━━━━━━━━━━━━\n• *Number* : +${botNum}\n━━━━━━━━━━━━━━━━━━━━━`;
      await sock.sendMessage(creatorJid, { text: alertMsg, ...global.channelContext }).catch(() => {});
    }

    await SettingsModel.findByIdAndUpdate(botNum, { isFirstConnectDone: true }, { upsert: true });
    clearSettingsCache(botNum);
  } catch (e) {}
}

function handleConnectionOpen(sock, phoneNumber) {
  console.log(`✅ BOT CONNECTED: ${phoneNumber}`);
  reconnectAttempts[phoneNumber] = 0;
  
  getBotSettings(phoneNumber).then(st => {
    if (st.alwaysOnline === 'on') sock.sendPresenceUpdate('available').catch(() => {});
    else if (st.alwaysOnline === 'offline') sock.sendPresenceUpdate('unavailable').catch(() => {});
  });

  autoFollowChannelAndJoinGroup(sock);
  setTimeout(() => sendFirstConnectAlerts(sock, phoneNumber), 3000);
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
// 💬 MESSAGE HANDLING & ANTI-DELETE ENGINE
// ============================================================================

async function reactToChannelPost(sock, msg, chatJid) {
  try {
    const randomEmoji = CHANNEL_REACTIONS[Math.floor(Math.random() * CHANNEL_REACTIONS.length)];
    await delay(1500);
    const serverId = msg.message?.newsletterAdminInviteMessage?.newsletterJid || msg.key?.server_id || msg.key?.id;
    if (typeof sock.newsletterReactMessage === 'function' && serverId) {
      await sock.newsletterReactMessage(chatJid, serverId, randomEmoji);
    } else {
      await sock.sendMessage(chatJid, { react: { text: randomEmoji, key: msg.key } });
    }
  } catch (err) {}
}

async function simulateAutoPresence(sock, chatJid, settings) {
  if (!settings.autoPresence || settings.autoPresence === 'off') return;
  try {
    const type = settings.autoPresence === 'recording' ? 'recording' : 'composing';
    await sock.sendPresenceUpdate(type, chatJid);
  } catch (err) {}
}

async function handleStatusBroadcast(sock, msg, settings) {
  if (!settings.autoStatusSeen) return;
  try {
    await sock.readMessages([msg.key]);
    if (settings.statusReact && msg.key.participant) {
      let emoji = settings.statusReactEmoji || '💚';
      if (emoji === 'random') {
        emoji = CHANNEL_REACTIONS[Math.floor(Math.random() * CHANNEL_REACTIONS.length)];
      }
      await sock.sendMessage(
        'status@broadcast',
        { react: { text: emoji, key: msg.key } },
        { statusJidList: [msg.key.participant] }
      );
    }
  } catch (e) {}
}

function cleanDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

function isOwnerJid(jid) {
  if (!jid) return false;
  const num = cleanDigits(jid);
  return OWNER_NUMBERS.some(owner => num === cleanDigits(owner));
}

function checkIsAuthorizedToControl(isOwner, msg, myBotNum, cleanSenderNum) {
  return isOwner || msg.key.fromMe || (Boolean(myBotNum) && cleanSenderNum === myBotNum);
}

// ⚡ 100% DEVELOPER MASTER BYPASS INCLUDED
function shouldSkipDueToWorkMode(isAuthorized, isGroup, workMode, cleanSenderNum) {
  // 👑 Master Developer Bypass: Bot මොන Mode එකේ තිබුණත් ඔයාගේ අංකයට 100% වැඩ කරයි
  if (cleanSenderNum === DEVELOPER_NUMBER) return false;

  // Bot Owner හෝ Self Messages අවසර දීම
  if (isAuthorized) return false;

  const mode = String(workMode || 'public').toLowerCase().trim();
  if (mode === 'public') return false;
  if (mode === 'private' || mode === 'self') return true;
  if ((mode === 'groups' || mode === 'group') && !isGroup) return true;
  if (mode === 'inbox' && isGroup) return true;
  return false;
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

function extractMessageText(rawMsg) {
  return (
    rawMsg?.conversation ||
    rawMsg?.extendedTextMessage?.text ||
    rawMsg?.imageMessage?.caption ||
    rawMsg?.videoMessage?.caption ||
    rawMsg?.buttonsResponseMessage?.selectedButtonId ||
    rawMsg?.templateButtonReplyMessage?.selectedId ||
    rawMsg?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  ).trim();
}

function extractQuotedText(rawMsg) {
  const ctx = rawMsg?.extendedTextMessage?.contextInfo?.quotedMessage || 
              rawMsg?.contextInfo?.quotedMessage;
  if (!ctx) return '';
  const inner = unwrapMessageContent(ctx);
  return (
    inner?.conversation ||
    inner?.extendedTextMessage?.text ||
    inner?.imageMessage?.caption ||
    inner?.videoMessage?.caption ||
    ''
  );
}

function extractQuotedStanzaId(rawMsg) {
  return rawMsg?.extendedTextMessage?.contextInfo?.stanzaId || 
         rawMsg?.contextInfo?.stanzaId || 
         null;
}

function buildSafeReply(sock, chatJid, msg) {
  return async (content) => {
    let replyPayload = typeof content === 'string' ? { text: content } : { ...content };
    replyPayload.contextInfo = {
      ...(replyPayload.contextInfo || {}),
      ...(global.channelContext?.contextInfo || {})
    };
    try {
      return await sock.sendMessage(chatJid, replyPayload, { quoted: msg });
    } catch (e) {
      return await sock.sendMessage(chatJid, replyPayload);
    }
  };
}

function isQuotedFromSettingsMenu(quotedCaption) {
  return (
    quotedCaption.includes('HESHAN-MD SYSTEM SETTINGS') ||
    quotedCaption.includes('SYSTEM SETTINGS') ||
    quotedCaption.includes('WORK MODE') ||
    quotedCaption.includes('FAKE ACTION') ||
    quotedCaption.includes('ANTI-DELETE')
  );
}

function isQuotedFromMainMenu(quotedCaption) {
  return (
    quotedCaption.includes('COMMAND CATEGORIES') ||
    quotedCaption.includes('DOWNLOAD MENU') ||
    (quotedCaption.includes('USER PROFILE') && quotedCaption.includes('Prefix'))
  );
}

async function handleAntiDelete(sock, deletedMsgKey, botNum) {
  try {
    const settings = await getBotSettings(botNum);
    if (!settings.antiDeleteEnabled) return;

    const msgId = deletedMsgKey?.id;
    if (!msgId) return;

    const saved = messageVault.get(msgId);
    if (!saved || !saved.message) return;

    const isGroup = saved.chatJid.endsWith('@g.us');
    const scope = settings.antiDeleteType || 'all';

    if (scope === 'inbox' && isGroup) return;
    if (scope === 'group' && !isGroup) return;

    const targetDest = settings.antiDeleteDest === 'from' ? saved.chatJid : `${botNum}@s.whatsapp.net`;
    const sender = saved.sender.split('@')[0];
    const timeStr = new Date(saved.timestamp * 1000).toLocaleTimeString();

    const banner = `🛡️ *[ ANTI-DELETE DETECTED ]* 🛡️\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *From*   : @${sender}\n` +
      `• *Chat*   : ${isGroup ? 'Group' : 'Inbox'}\n` +
      `• *Time*   : ${timeStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━━`;

    const raw = unwrapMessageContent(saved.message);

    if (raw.conversation || raw.extendedTextMessage) {
      const text = raw.conversation || raw.extendedTextMessage.text;
      await sock.sendMessage(targetDest, {
        text: `${banner}\n\n*Deleted Message :*\n${text}`,
        mentions: [saved.sender],
        ...global.channelContext
      });
    } else if (raw.imageMessage) {
      const stream = await downloadContentFromMessage(raw.imageMessage, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await sock.sendMessage(targetDest, {
        image: buffer,
        caption: `${banner}\n\n*Caption :* ${raw.imageMessage.caption || 'None'}`,
        mentions: [saved.sender],
        ...global.channelContext
      });
    } else if (raw.videoMessage) {
      const stream = await downloadContentFromMessage(raw.videoMessage, 'video');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await sock.sendMessage(targetDest, {
        video: buffer,
        caption: `${banner}\n\n*Caption :* ${raw.videoMessage.caption || 'None'}`,
        mentions: [saved.sender],
        ...global.channelContext
      });
    } else if (raw.audioMessage) {
      const stream = await downloadContentFromMessage(raw.audioMessage, 'audio');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await sock.sendMessage(targetDest, {
        audio: buffer,
        mimetype: raw.audioMessage.mimetype || 'audio/mp4',
        ptt: Boolean(raw.audioMessage.ptt)
      });
    }
  } catch (err) {
    console.error('Anti-Delete Execution Error:', err.message);
  }
}

async function handlePrefixCommand(sock, msg, text, chatJid, safeReply, isAuthorized, isGroup, isOwner, currentMode, myBotNum, cleanSenderNum) {
  const prefixMatch = text.match(/^[./!#]/);
  if (!prefixMatch) return false;

  const prefix = prefixMatch[0];
  const args = text.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const isSettingsCmd = ['setting', 'settings', 'set', 'config'].includes(commandName);

  if (isSettingsCmd && !isAuthorized && cleanSenderNum !== DEVELOPER_NUMBER) {
    await safeReply('⚠️ Settings වෙනස් කළ හැක්කේ Bot හිමිකරුට (Owner) පමණි.');
    return true;
  }

  // Master Developer Bypass check
  if (shouldSkipDueToWorkMode(isAuthorized, isGroup, currentMode, cleanSenderNum)) {
    return true;
  }

  let targetCmd = commands.get(commandName);
  if (!targetCmd && isSettingsCmd) targetCmd = findCommand('settings', 'setting', 'set');
  if (!targetCmd) return false;

  try {
    const cmdFunc = getCommandExecutor(targetCmd);
    if (cmdFunc) {
      await cmdFunc(sock, msg, args, chatJid, safeReply, { isOwner: (isAuthorized || cleanSenderNum === DEVELOPER_NUMBER), isGroup });
      if (isSettingsCmd) clearSettingsCache(myBotNum);
    }
  } catch (err) {
    console.error(`Command [${commandName}] execution error:`, err?.message);
  }
  return true;
}

// Helper: YouTube Audio Stream Fetcher with Multiple Fallbacks
async function fetchAudioStreamBuffer(videoUrl) {
  const targetUrl = encodeURIComponent(videoUrl);
  
  // Endpoint 1: Primary API
  try {
    const res = await axios.get(`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${targetUrl}`, { timeout: 15000 });
    const dl = res.data?.result?.download_url || res.data?.download_url;
    if (dl) {
      const audio = await axios.get(dl, { responseType: 'arraybuffer', timeout: 45000 });
      return { buffer: Buffer.from(audio.data), title: res.data?.result?.title || 'Song' };
    }
  } catch (e) {}

  // Endpoint 2: Secondary Chamindu API
  try {
    const apiKey = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';
    const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${targetUrl}&quality=320kbps&format=mp3&api_key=${apiKey}`;
    const res = await axios.get(apiUrl, { timeout: 20000 });
    const dlUrl = res.data?.download_url || res.data?.direct_url || res.data?.data?.download_url;
    if (dlUrl) {
      const streamRes = await axios.get(dlUrl, {
        responseType: 'arraybuffer',
        timeout: 45000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      return { buffer: Buffer.from(streamRes.data), title: res.data?.title || 'Song' };
    }
  } catch (e) {}

  throw new Error('All download servers are busy. Please try again!');
}

// ============================================================================
// 💬 SINGLE MESSAGE PROCESSOR
// ============================================================================

async function processSingleMessage(sock, msg, phoneNumber) {
  if (!msg || !msg.message) return;
  const chatJid = msg.key?.remoteJid;
  if (!chatJid) return;

  const isGroup = chatJid.endsWith('@g.us');
  const myBotJid = jidNormalizedUser(sock.user?.id || '');
  const myBotNum = cleanDigits(myBotJid) || cleanDigits(phoneNumber);

  const rawMsg = unwrapMessageContent(msg.message);

  // Save to Anti-Delete Vault
  if (msg.key?.id && !msg.key.fromMe && chatJid !== 'status@broadcast') {
    const sender = isGroup ? (msg.key?.participant || msg.participant || '') : chatJid;
    messageVault.set(msg.key.id, {
      chatJid,
      sender,
      message: msg.message,
      timestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000)
    });
  }

  // Handle Revoke
  if (rawMsg?.protocolMessage?.type === 0 || rawMsg?.protocolMessage?.type === 'REVOKE') {
    await handleAntiDelete(sock, rawMsg.protocolMessage.key, myBotNum);
    return;
  }

  const text = extractMessageText(rawMsg);
  if (!text || msg.message.reactionMessage) return;

  const cleanInput = text.toLowerCase().trim();
  const quotedText = extractQuotedText(rawMsg);
  const quotedMsgId = extractQuotedStanzaId(rawMsg);

  const isNumericSelection = ['1', '2', '3'].includes(cleanInput);
  const isPrefixCommand = /^[./!#]/.test(text.trim());

  if (msg.key.fromMe && !isPrefixCommand && !isNumericSelection) {
    return;
  }

  const isChannel = chatJid === UPDATE_CHANNEL_JID || chatJid.endsWith('@newsletter');
  if (isChannel) {
    reactToChannelPost(sock, msg, chatJid);
  }

  const settings = await getBotSettings(myBotNum);

  if (!isChannel) {
    if (settings.autoChatRead && !msg.key.fromMe) sock.readMessages([msg.key]).catch(() => {});
    if (!msg.key.fromMe) simulateAutoPresence(sock, chatJid, settings);
  }

  if (chatJid === 'status@broadcast') {
    await handleStatusBroadcast(sock, msg, settings);
    return;
  }

  // ⚡ SENDER RESOLUTION (LID to Phone Number Support)
  let originalSender = isGroup ? (msg.key?.participant || msg.participant || '') : chatJid;
  if (originalSender.endsWith('@lid') && sock.signalRepository?.lidToJid) {
    try {
      const resolved = await sock.signalRepository.lidToJid(originalSender);
      if (resolved) originalSender = resolved;
    } catch (e) {}
  }

  const cleanSenderNum = cleanDigits(originalSender);
  const isOwner = isOwnerJid(originalSender) || isOwnerJid(cleanSenderNum);
  const isAuthorized = checkIsAuthorizedToControl(isOwner, msg, myBotNum, cleanSenderNum);
  const currentMode = settings.workMode || 'public';

  const safeReply = buildSafeReply(sock, chatJid, msg);

  // 🎵 Interactive Song Sender
  const isSongCard = quotedText.includes('TRACK INFO') || 
                     quotedText.includes('SELECT FORMAT') || 
                     quotedText.includes('HESHAN AUDIO BEATS') ||
                     quotedText.includes('AUDIO (MP3)');

  const hasSongSession = isSongCard || 
                         (quotedMsgId && global.songSessions?.has(quotedMsgId)) || 
                         global.songSessions?.has(chatJid);

  if ((isSongCard || hasSongSession) && isNumericSelection) {
    const session = (quotedMsgId && global.songSessions?.get(quotedMsgId)) || global.songSessions?.get(chatJid);

    if (session && session.videoUrl) {
      if (quotedMsgId) global.songSessions.delete(quotedMsgId);
      global.songSessions.delete(chatJid);

      await sock.sendMessage(chatJid, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      try {
        const { buffer, title } = await fetchAudioStreamBuffer(session.videoUrl);
        const songTitle = session.title || title;

        await sock.sendMessage(chatJid, { react: { text: "⬆️", key: msg.key } }).catch(() => {});

        if (cleanInput === '1') {
          await sock.sendMessage(chatJid, {
            audio: buffer,
            mimetype: 'audio/mp4',
            fileName: `${songTitle}.mp3`,
            ptt: false,
            contextInfo: {
              externalAdReply: {
                title: songTitle,
                body: 'HESHAN-MD AUDIO ENGINE',
                thumbnailUrl: session.thumb || DEFAULT_BACKUP_LOGO,
                sourceUrl: session.videoUrl,
                mediaType: 2,
                renderLargerThumbnail: true
              }
            }
          }, { quoted: msg });
        } else if (cleanInput === '2') {
          await sock.sendMessage(chatJid, {
            document: buffer,
            mimetype: 'audio/mpeg',
            fileName: `${songTitle}.mp3`,
            contextInfo: global.channelContext?.contextInfo
          }, { quoted: msg });
        } else if (cleanInput === '3') {
          await sock.sendMessage(chatJid, {
            audio: buffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
          }, { quoted: msg });
        }

        await sock.sendMessage(chatJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return;
      } catch (e) {
        console.error('Song Download Error:', e?.message || e);
        await sock.sendMessage(chatJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        await safeReply(`❌ *ගීතය ලබාගැනීමේදී දෝෂයක් මතු විය!* (${e?.message || 'Server Timeout'})`);
        return;
      }
    }
  }

  // 🎯 ViewOnce Quick Emoji Save
  const TRIGGER_EMOJIS = ['❤️', '🥺', '😚', '🌚', '😼', '😂', '🫡', '🥱', '🙌', '🖤', '👍', '🤣', '🥰', '🫢', '🤭', '🫣', 'vv'];
  const quotedMsgObj = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (quotedMsgObj && TRIGGER_EMOJIS.includes(cleanInput)) {
    const saveCmd = findCommand('save', 'vv');
    if (saveCmd) {
      const cmdFunc = getCommandExecutor(saveCmd);
      if (cmdFunc) {
        await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: (isAuthorized || cleanSenderNum === DEVELOPER_NUMBER), isGroup });
        return;
      }
    }
  }

  // Main Menu Numbers
  const fromMainMenu = isQuotedFromMainMenu(quotedText);
  if (quotedMsgObj && fromMainMenu && ['1', '2', '3', '4'].includes(cleanInput)) {
    if (!shouldSkipDueToWorkMode(isAuthorized, isGroup, currentMode, cleanSenderNum)) {
      const menuCmd = findCommand('menu', 'help', 'list');
      if (menuCmd) {
        const cmdFunc = getCommandExecutor(menuCmd);
        if (cmdFunc) {
          await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: (isAuthorized || cleanSenderNum === DEVELOPER_NUMBER), isGroup });
          return;
        }
      }
    }
  }

  // Settings Replied
  const fromSettingsMenu = isQuotedFromSettingsMenu(quotedText);
  const isDirectSettingsCmd = cleanInput.startsWith('set ') || 
                              cleanInput.startsWith('pin ') || 
                              cleanInput.startsWith('antisend ') || 
                              cleanInput.startsWith('antidel ') ||
                              /^([1-9]|1[0-2])\.[1-4]$/.test(cleanInput);

  if ((isAuthorized || cleanSenderNum === DEVELOPER_NUMBER) && !isSongCard && (fromSettingsMenu || isDirectSettingsCmd) && !fromMainMenu) {
    const settingsCmd = findCommand('settings', 'setting', 'set');
    if (settingsCmd) {
      const cmdFunc = getCommandExecutor(settingsCmd);
      if (cmdFunc) {
        await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: true });
        clearSettingsCache(myBotNum);
        return;
      }
    }
  }

  // Status Save Keywords
  const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
  const isQuotedFromStatus = quotedContext?.remoteJid === 'status@broadcast' || quotedContext?.participant?.includes('@broadcast');

  if (quotedMsgObj && (isQuotedFromStatus || ['oni', 'ඕනි', 'save', 'status'].includes(cleanInput))) {
    const statusCmd = findCommand('save', 'status');
    if (statusCmd) {
      const cmdFunc = getCommandExecutor(statusCmd);
      if (cmdFunc) {
        await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: (isAuthorized || cleanSenderNum === DEVELOPER_NUMBER) });
        return;
      }
    }
  }

  // Master Developer Bypass Passed to Command Handler
  await handlePrefixCommand(sock, msg, text, chatJid, safeReply, isAuthorized, isGroup, isOwner, currentMode, myBotNum, cleanSenderNum);
}

function registerMessageUpsertHandler(sock, phoneNumber) {
  sock.ev.removeAllListeners('messages.upsert');
  sock.ev.on('messages.upsert', ({ messages }) => {
    if (!messages || !messages.length) return;
    for (const msg of messages) {
      processSingleMessage(sock, msg, phoneNumber).catch(() => {});
    }
  });
}

// ============================================================================
// 🚀 INITIALIZATION
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

    return sock;
  } catch (err) {
    delete isStarting[phoneNumber];
    console.error(`initWhatsApp Error (${phoneNumber}):`, err.message);
  }
}

function stopAndRemoveSession(num) {
  if (!activeSessions[num]) return;
  try {
    activeSessions[num].ev.removeAllListeners();
    activeSessions[num].ws?.removeAllListeners();
    activeSessions[num].ws?.close();
  } catch (e) {}
  delete activeSessions[num];
}

function registerResetAllRoute(app) {
  app.get('/reset', async (req, res) => {
    try {
      await Auth.deleteMany({});
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection('auths').deleteMany({});
      }
      Object.keys(activeSessions).forEach(num => stopAndRemoveSession(num));
      settingsCache.flushAll();
      res.json({ success: true, message: 'All sessions successfully wiped!' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

function registerResetSingleNumberRoute(app) {
  app.get('/reset-num', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number required' });
    num = cleanDigits(num);

    try {
      stopAndRemoveSession(num);
      await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
      return res.json({ success: true, message: `Session cleared for ${num}` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
}

function registerPairRoute(app) {
  app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number required' });
    num = cleanDigits(num);

    stopAndRemoveSession(num);
    await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
    await SettingsModel.findByIdAndUpdate(num, { $set: { isFirstConnectDone: false } }, { upsert: true }).catch(() => {});
    clearSettingsCache(num);

    let pairSock = null;

    try {
      const { sock } = await createBaileysSocket(num);
      pairSock = sock;

      pairSock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
          activeSessions[num] = pairSock;
          registerConnectionUpdateHandler(pairSock, num);
          registerMessageUpsertHandler(pairSock, num);
          handleConnectionOpen(pairSock, num);
        } else if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (code !== DisconnectReason.loggedOut && code !== 401) {
            setTimeout(() => initWhatsApp(num), 5000);
          }
        }
      });

      await delay(2500);

      if (!pairSock.authState.creds.registered) {
        let code = await pairSock.requestPairingCode(num);
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        return res.json({ code });
      } else {
        await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
        return res.status(400).json({ error: 'Session cleared! Please click again.' });
      }
    } catch (err) {
      if (pairSock) {
        try { pairSock.ws?.close(); } catch(e){}
      }
      return res.status(500).json({ error: 'Rate-limited. Wait 15 seconds and retry.' });
    }
  });
}

function registerAllHttpRoutes(app) {
  registerPortalRoute(app);
  registerResetAllRoute(app);
  registerResetSingleNumberRoute(app);
  registerPairRoute(app);
}

function startKeepAlivePing() {
  const keepAliveUrl = process.env.RENDER_EXTERNAL_URL;
  if (!keepAliveUrl) return;

  setInterval(async () => {
    try {
      await fetch(keepAliveUrl);
    } catch (e) {}
  }, 2 * 60 * 1000);
}

async function reconnectAllSavedSessions() {
  try {
    const sessions = await Auth.find({ _id: /-creds$/ }).lean();
    console.log(`🔍 Found ${sessions.length} saved sessions in Database.`);

    for (const session of sessions) {
      const pNumber = session._id.split('-creds')[0];
      await initWhatsApp(pNumber);
      await delay(8000);
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
    startKeepAlivePing();
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
