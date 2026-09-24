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
  WAMessageStubType,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

// 🟢 Global Process Crash Guards
process.on('uncaughtException', (err) => {
  console.error('🛡️ Uncaught Exception Guard:', err?.message || err);
});
process.on('unhandledRejection', (err) => {
  console.error('🛡️ Unhandled Rejection Guard:', err?.message || err);
});

// 🟢 Config & DB Models
const { MONGODB_URI, BOT_NAME, OWNER_NUMBER } = require('./config');
const { useMongoDBAuthState, Auth } = require('./auth');

let askAI = null;
try {
  askAI = require('./ai').askAI;
} catch (e) {
  askAI = async () => null;
}

// ============================================================================
// 🌍 GLOBAL CONSTANTS
// ============================================================================

const UPDATE_CHANNEL_JID = '120363421906774107@newsletter';
const BOT_CHANNEL_NAME = '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨';
const CHANNEL_REACTIONS = ['🩶', '💙', '❤️', '💛', '🧡', '💗', '🩵'];
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

const REAL_OWNER_NUMBER = OWNER_NUMBER || '94719845166';
const OWNER_NUMBERS = [
  REAL_OWNER_NUMBER,
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
  autoChatRead: false,
  aiChatEnabled: false,
  antiDeleteEnabled: true,
  antiDeleteType: 'all',
  antiDeleteDest: 'me',
  securityPin: '1234',
  isFirstConnectDone: false
};

// ============================================================================
// 🧠 RUNTIME STATE & PERMANENT MESSAGE STORE
// ============================================================================

const settingsCache = new NodeCache({ stdTTL: 300, checkperiod: 60, maxKeys: 200 });
const globalMsgStore = new NodeCache({ stdTTL: 14400, checkperiod: 300, maxKeys: 20000 });

const activeSessions = {};
global.activeSessions = activeSessions;
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
// 🌐 UI PORTAL
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
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=JetBrains+Mono:wght@700;800&display=swap" rel="stylesheet">
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
        body {
          background-color: var(--bg-core);
          background-image: 
            radial-gradient(circle at 50% 0%, rgba(225, 29, 72, 0.18) 0%, transparent 60%),
            radial-gradient(circle at 10% 90%, rgba(159, 18, 57, 0.12) 0%, transparent 45%);
          color: var(--text-main);
          font-family: 'Outfit', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
        }
        .portal-card {
          background: var(--panel-bg);
          backdrop-filter: blur(28px) saturate(160%);
          border: 1px solid var(--border-glass);
          border-radius: 28px;
          padding: 44px 34px;
          width: 100%;
          max-width: 440px;
          text-align: center;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65), 0 0 45px var(--accent-glow);
          position: relative;
        }
        .portal-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, transparent, var(--accent-red), transparent);
        }
        .badge-status {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
          color: var(--crimson-soft); background: rgba(225, 29, 72, 0.12);
          border: 1px solid rgba(225, 29, 72, 0.28); padding: 5px 14px; border-radius: 30px; margin-bottom: 20px;
        }
        .badge-dot { width: 6px; height: 6px; background: var(--accent-red); border-radius: 50%; box-shadow: 0 0 8px var(--accent-red); }
        .app-title {
          font-size: 30px; font-weight: 800; letter-spacing: -0.5px;
          background: linear-gradient(135deg, #ffffff 40%, var(--crimson-soft) 80%, var(--accent-red) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 6px;
        }
        .app-desc { font-size: 13.5px; color: var(--text-muted); margin-bottom: 30px; }
        .input-wrap { position: relative; margin-bottom: 16px; }
        .phone-input {
          width: 100%; padding: 16px 20px; border-radius: 16px; border: 1px solid var(--border-glass);
          background: rgba(12, 3, 6, 0.7); color: var(--text-main); font-size: 17px; font-weight: 600;
          letter-spacing: 0.8px; text-align: center; outline: none; transition: all 0.3s ease;
        }
        .phone-input:focus { border-color: var(--border-focus); box-shadow: 0 0 24px rgba(225, 29, 72, 0.35); background: rgba(18, 4, 9, 0.9); }
        .btn-action {
          width: 100%; padding: 16px; border-radius: 16px; border: none;
          background: linear-gradient(135deg, #be123c 0%, var(--accent-red) 100%);
          color: #ffffff; font-size: 14.5px; font-weight: 700; cursor: pointer; transition: all 0.25s ease;
          box-shadow: 0 8px 24px rgba(225, 29, 72, 0.3); margin-bottom: 12px;
        }
        .btn-action:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(225, 29, 72, 0.45); }
        .btn-reset {
          width: 100%; padding: 13px; border-radius: 14px; border: 1px solid rgba(225, 29, 72, 0.25);
          background: rgba(225, 29, 72, 0.08); color: var(--crimson-soft); font-size: 12.5px; font-weight: 600; cursor: pointer;
        }
        .code-container { display: none; margin-top: 24px; }
        .code-box {
          font-family: 'JetBrains Mono', monospace; font-size: 30px; font-weight: 800; letter-spacing: 4px;
          color: #ffe4e6; background: rgba(225, 29, 72, 0.14); border: 1.5px dashed rgba(251, 113, 133, 0.45);
          padding: 18px; border-radius: 16px; cursor: pointer;
        }
        .copy-tag { font-size: 11.5px; color: var(--text-muted); margin-top: 8px; }
        .footer-note { margin-top: 28px; font-size: 11px; color: rgba(255, 255, 255, 0.25); text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="portal-card">
        <div class="badge-status"><span class="badge-dot"></span> Online System</div>
        <h1 class="app-title">${botName}</h1>
        <p class="app-desc">Enter phone number with country code (e.g. 9471xxxxxxx)</p>
        <div class="input-wrap">
          <input type="text" id="phone" class="phone-input" placeholder="947xxxxxxxx" />
        </div>
        <button id="btn" class="btn-action" onclick="fetchPairCode()">GET PAIRING CODE</button>
        <button class="btn-reset" onclick="cleanSessionSlot()">CLEAN THIS SESSION</button>
        <div class="code-container" id="codeWrapper">
          <div class="code-box" id="codeDisplay" onclick="copyCode()"></div>
          <div class="copy-tag">Click code to copy</div>
        </div>
        <p class="footer-note">Powered by Heshan MD</p>
      </div>
      <script>
        async function fetchPairCode() {
          const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
          if (!phone || phone.length < 10) return alert('කරුණාකර නිවැරදි Country Code සහිත අංකය ඇතුළත් කරන්න!');
          const btn = document.getElementById('btn');
          const wrapper = document.getElementById('codeWrapper');
          const display = document.getElementById('codeDisplay');
          btn.innerText = 'GENERATING CODE...';
          btn.disabled = true;
          wrapper.style.display = 'none';
          try {
            const res = await fetch('/pair?num=' + phone);
            const data = await res.json();
            if (data.code) {
              display.innerText = data.code;
              wrapper.style.display = 'block';
              navigator.clipboard.writeText(data.code).catch(()=>{});
            } else {
              alert(data.error || 'Connection busy. Please wait 10 seconds and retry.');
            }
          } catch(e) {
            alert('Server connection error. Please refresh and retry!');
          }
          btn.innerText = 'GET PAIRING CODE';
          btn.disabled = false;
        }
        async function cleanSessionSlot() {
          const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
          if (!phone) return alert('Phone Number එක ඇතුළත් කරන්න!');
          if (confirm('+' + phone + ' Session එක Clean කරන්නද?')) {
            try {
              const res = await fetch('/reset-num?num=' + phone);
              const data = await res.json();
              if (data.success) alert('✅ Session Cleared!');
            } catch(e) {
              alert('Clean request failed!');
            }
          }
        }
        function copyCode() {
          const code = document.getElementById('codeDisplay').innerText;
          if (code) {
            navigator.clipboard.writeText(code);
            alert('✅ Copied: ' + code);
          }
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
// 🔌 SOCKET CREATION (Ubuntu/Chrome Profile)
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
    browser: Browsers.ubuntu('Chrome'),
    msgRetryCounterCache,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    markOnlineOnConnect: true,
    emitOwnEvents: false
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
  let delayTime = 6000;

  if (statusCode === 440) {
    delayTime = Math.min(reconnectAttempts[phoneNumber] * 10000, 45000);
  } else if (reconnectAttempts[phoneNumber] > 5) {
    delayTime = 25000;
  }

  setTimeout(() => {
    initWhatsApp(phoneNumber);
  }, delayTime);
}

function handleConnectionOpen(sock, phoneNumber) {
  console.log(`✅ BOT CONNECTED: ${phoneNumber}`);
  reconnectAttempts[phoneNumber] = 0;
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
    ''
  ).trim();
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

async function processSingleMessage(sock, msg, phoneNumber) {
  if (!msg || !msg.message) return;
  const chatJid = msg.key?.remoteJid;
  if (!chatJid || chatJid === 'status@broadcast') return;

  const rawMsg = unwrapMessageContent(msg.message);
  const text = extractMessageText(rawMsg);
  if (!text) return;

  const safeReply = buildSafeReply(sock, chatJid, msg);
  const prefixMatch = text.match(/^[./!#]/);
  if (!prefixMatch) return;

  const prefix = prefixMatch[0];
  const args = text.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const targetCmd = commands.get(commandName);
  if (!targetCmd) return;

  try {
    const cmdFunc = getCommandExecutor(targetCmd);
    if (cmdFunc) {
      const isOwner = msg.key.fromMe || OWNER_NUMBERS.some(o => (msg.key.participant || chatJid).includes(o));
      await cmdFunc(sock, msg, args, chatJid, safeReply, { isOwner, isGroup: chatJid.endsWith('@g.us') });
    }
  } catch (err) {
    console.error(`Command [${commandName}] execution error:`, err?.message);
  }
}

function registerMessageUpsertHandler(sock, phoneNumber) {
  sock.ev.on('messages.upsert', ({ messages }) => {
    if (!messages || !messages.length) return;
    for (const msg of messages) {
      processSingleMessage(sock, msg, phoneNumber).catch(() => {});
    }
  });
}

// ============================================================================
// 🚀 BOT INITIALIZATION
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
    activeSessions[num].ws?.close();
  } catch (e) {}
  delete activeSessions[num];
}

// ============================================================================
// 🌐 PAIRING ROUTE (STABLE LINK DEVICE)
// ============================================================================

function registerPairRoute(app) {
  app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Phone number is required!' });

    num = num.replace(/[^0-9]/g, '');
    if (num.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number format!' });
    }

    stopAndRemoveSession(num);
    delete isStarting[num];

    try {
      await Auth.deleteMany({ _id: { $regex: `^${num}-` } });
      clearSettingsCache(num);
    } catch (e) {
      console.error('Session clean error:', e.message);
    }

    let pairSock = null;

    try {
      const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(num);
      const logger = pino({ level: 'silent' });
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

      pairSock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        markOnlineOnConnect: false,
        emitOwnEvents: false
      });

      pairSock.ev.on('creds.update', saveCreds);

      pairSock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
          activeSessions[num] = pairSock;
          registerConnectionUpdateHandler(pairSock, num, clearSessionData);
          registerMessageUpsertHandler(pairSock, num);
          handleConnectionOpen(pairSock, num);
        } else if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (code !== DisconnectReason.loggedOut && code !== 401) {
            setTimeout(() => initWhatsApp(num), 6000);
          }
        }
      });

      // Render server websocket ready වීමට delay එක 8s තබා ඇත
      await delay(8000);

      if (!pairSock.authState.creds.registered) {
        let code = await pairSock.requestPairingCode(num);
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        return res.json({ code });
      } else {
        return res.status(400).json({ error: 'Already registered session! Clean session first.' });
      }
    } catch (err) {
      console.error(`❌ Pairing Error for ${num}:`, err?.message || err);
      if (pairSock) {
        try {
          pairSock.ev.removeAllListeners();
          pairSock.ws?.close();
        } catch (e) {}
      }
      return res.status(500).json({
        error: 'Pairing failed: ' + (err?.message || 'Server timeout. Wait 10 seconds and retry.')
      });
    }
  });
}

function registerAllHttpRoutes(app) {
  registerPortalRoute(app);
  registerPairRoute(app);

  app.get('/reset-num', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number required' });
    num = num.replace(/[^0-9]/g, '');

    try {
      stopAndRemoveSession(num);
      await Auth.deleteMany({ _id: { $regex: `^${num}-` } });
      clearSettingsCache(num);
      return res.json({ success: true, message: `Session cleared for ${num}` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
}

// ============================================================================
// 🔁 STARTUP & KEEP ALIVE
// ============================================================================

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
    const sessions = await Auth.find({ _id: { $regex: /-creds$/ } }).lean();
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

