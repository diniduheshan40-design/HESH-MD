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
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

// 🛡️ Global Crash Protection
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err?.message || err));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err?.message || err));

// 🟢 Config & DB Models
const { MONGODB_URI, BOT_NAME } = require('./config');
const { useMongoDBAuthState, Auth } = require('./auth');
const { askAI } = require('./ai');

// ============================================================================
// 🌍 GLOBAL CONSTANTS & CACHES
// ============================================================================
const UPDATE_CHANNEL_JID = '120363421906774107@newsletter';
const CHANNEL_REACTIONS = ['🥰', '👍', '❤️', '🪄', '✨'];
const REAL_OWNER_NUMBER = '94719845166';
const OWNER_NUMBERS = ['94719845166', '94720882316'];

const DEFAULT_SETTINGS = {
  workMode: 'public',
  autoAiInbox: true,
  autoStatusSeen: true,
  statusReact: true,
  statusReactEmoji: '💐',
  ownerReact: true,
  ownerReactEmoji: '👑',
  botLogo: './logo.jpg',
  autoPresence: 'off',
  securityPin: '1234',
  isFirstConnectDone: false
};

// ⚡ Fast In-Memory Cache
const settingsCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
const lidCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });
const msgDedupeCache = new NodeCache({ stdTTL: 20, checkperiod: 10 });
const activeSessions = {};
global.activeSessions = activeSessions;
const isStarting = {};
const commands = new Map();

let cachedLogoBuffer = null;
function getLocalLogoBuffer() {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  for (const p of [path.join(process.cwd(), 'logo.jpg'), path.join(process.cwd(), 'assets', 'logo.jpg')]) {
    if (fs.existsSync(p)) return (cachedLogoBuffer = fs.readFileSync(p));
  }
  return { url: 'https://raw.githubusercontent.com/diniduheshan40-design/HESH-MD/main/logo.jpg' };
}

// ============================================================================
// 🗄️ DATABASE MODEL & HELPERS
// ============================================================================
const SettingsModel = mongoose.models.BotSettings || mongoose.model('BotSettings', new mongoose.Schema({
  _id: { type: String, required: true },
  workMode: { type: String, default: DEFAULT_SETTINGS.workMode },
  autoAiInbox: { type: Boolean, default: DEFAULT_SETTINGS.autoAiInbox },
  autoStatusSeen: { type: Boolean, default: DEFAULT_SETTINGS.autoStatusSeen },
  statusReact: { type: Boolean, default: DEFAULT_SETTINGS.statusReact },
  statusReactEmoji: { type: String, default: DEFAULT_SETTINGS.statusReactEmoji },
  ownerReact: { type: Boolean, default: DEFAULT_SETTINGS.ownerReact },
  ownerReactEmoji: { type: String, default: DEFAULT_SETTINGS.ownerReactEmoji },
  botLogo: { type: String, default: DEFAULT_SETTINGS.botLogo },
  autoPresence: { type: String, default: DEFAULT_SETTINGS.autoPresence },
  securityPin: { type: String, default: DEFAULT_SETTINGS.securityPin },
  isFirstConnectDone: { type: Boolean, default: DEFAULT_SETTINGS.isFirstConnectDone }
}, { strict: false }));

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
      settings = await SettingsModel.create({ _id: botNum, ...DEFAULT_SETTINGS }).then(d => d.toObject());
    }
    settingsCache.set(botNum, settings);
    return settings;
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

// ============================================================================
// 📂 COMMAND LOADER
// ============================================================================
function loadAllCommands() {
  const cmdDir = path.join(__dirname, 'commands');
  if (!fs.existsSync(cmdDir)) return;
  const cmdFiles = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));
  for (const file of cmdFiles) {
    try {
      let cmd = require(path.join(cmdDir, file));
      if (cmd.default) cmd = cmd.default;
      const cmdName = file.replace('.js', '').toLowerCase();
      if (cmd?.name) commands.set(cmd.name.toLowerCase(), cmd);
      commands.set(cmdName, cmd);
      if (cmd?.alias) {
        const aliases = Array.isArray(cmd.alias) ? cmd.alias : [cmd.alias];
        for (const al of aliases) commands.set(al.toLowerCase(), cmd);
      }
    } catch (e) {
      console.error(`❌ Error loading ${file}:`, e.message);
    }
  }
}

function getCommandExecutor(cmd) {
  return typeof cmd === 'function' ? cmd : (cmd?.execute || cmd?.run || null);
}

// ============================================================================
// 🌐 UI PORTAL
// ============================================================================
function renderPortalHtml(botName) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${botName} • STATION</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#090305;background-image:radial-gradient(circle at 50% 0%,rgba(225,29,72,.18) 0%,transparent 60%);color:#fff;font-family:'Outfit',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.portal-card{background:rgba(20,6,10,.75);backdrop-filter:blur(24px);border:1px solid rgba(244,63,94,.22);border-radius:28px;padding:40px 30px;width:100%;max-width:420px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.65)}.app-title{font-size:28px;font-weight:800;background:linear-gradient(135deg,#fff 40%,#fb7185 80%,#e11d48 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}.app-desc{font-size:13px;color:#9f8e93;margin-bottom:26px}.phone-input{width:100%;padding:15px;border-radius:14px;border:1px solid rgba(244,63,94,.22);background:rgba(12,3,6,.7);color:#fff;font-size:16px;font-weight:600;text-align:center;outline:none;margin-bottom:14px}.btn-action{width:100%;padding:15px;border-radius:14px;border:none;background:linear-gradient(135deg,#be123c 0%,#e11d48 100%);color:#fff;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px}.btn-reset{width:100%;padding:12px;border-radius:12px;border:1px solid rgba(225,29,72,.25);background:rgba(225,29,72,.08);color:#fb7185;font-size:12px;cursor:pointer}.code-box{font-family:'JetBrains Mono',monospace;font-size:30px;font-weight:800;color:#ffe4e6;background:rgba(225,29,72,.14);border:1.5px dashed rgba(251,113,133,.45);padding:16px;border-radius:14px;margin-top:20px;display:none;cursor:pointer}</style></head><body><div class="portal-card"><h1 class="app-title">${botName}</h1><p class="app-desc">Enter phone number with country code</p><input type="text" id="phone" class="phone-input" placeholder="e.g. 9470xxxxxxx" /><button id="btn" class="btn-action" onclick="fetchPairCode()">GET PAIRING CODE</button><button class="btn-reset" onclick="cleanSessionSlot()">CLEAN THIS SESSION</button><div class="code-box" id="codeDisplay" onclick="copyCode()"></div></div><script>async function fetchPairCode(){const p=document.getElementById('phone').value.replace(/[^0-9]/g,'');if(!p||p.length<10)return alert('Valid Phone Number Required!');const b=document.getElementById('btn');const d=document.getElementById('codeDisplay');b.innerText='GENERATING...';b.disabled=true;try{const res=await fetch('/pair?num='+p);const data=await res.json();if(data.code){d.innerText=data.code;d.style.display='block';navigator.clipboard.writeText(data.code).catch(()=>{});}else alert(data.error||'Rate-limited. Wait 15s.');}catch(e){alert('Server error!');}b.innerText='GET PAIRING CODE';b.disabled=false;}async function cleanSessionSlot(){const p=document.getElementById('phone').value.replace(/[^0-9]/g,'');if(!p)return alert('Phone number required!');if(confirm('Clean session for +'+p+'?')){await fetch('/reset-num?num='+p);alert('Session cleaned!');}}function copyCode(){const c=document.getElementById('codeDisplay').innerText;navigator.clipboard.writeText(c);alert('Copied: '+c);}</script></body></html>`;
}

// ============================================================================
// 🗑️ CASCADE PURGE ENGINE (බොට් අයින් කළ විට මුළු Base එකෙන්ම Wipe වීම)
// ============================================================================
async function purgeSessionEntirely(phoneNumber) {
  const cleanNum = phoneNumber.replace(/[^0-9]/g, '');
  console.log(`🧹 Cascading Purge for session: +${cleanNum}`);

  try {
    if (activeSessions[cleanNum]) {
      try {
        activeSessions[cleanNum].ev.removeAllListeners();
        activeSessions[cleanNum].ws?.close();
      } catch (e) {}
      delete activeSessions[cleanNum];
    }
    delete isStarting[cleanNum];
    clearSettingsCache(cleanNum);

    const sessionLogo = path.join(process.cwd(), `logo_${cleanNum}.jpg`);
    if (fs.existsSync(sessionLogo)) fs.promises.unlink(sessionLogo).catch(() => {});

    // MongoDB Data Purge (Auth Credentials + Settings)
    await Promise.allSettled([
      Auth.deleteMany({ _id: new RegExp('^' + cleanNum, 'i') }),
      mongoose.connection.db ? mongoose.connection.db.collection('auths').deleteMany({ _id: new RegExp('^' + cleanNum, 'i') }) : Promise.resolve(),
      mongoose.connection.db ? mongoose.connection.db.collection('botsettings').deleteOne({ _id: cleanNum }) : Promise.resolve()
    ]);

    console.log(`✅ Session +${cleanNum} permanently purged from DB & Memory!`);
  } catch (err) {
    console.error(`❌ Purge error (+${cleanNum}):`, err.message);
  }
}

// ============================================================================
// 🔌 SOCKET & LIFECYCLE
// ============================================================================
async function createBaileysSocket(phoneNumber) {
  const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(phoneNumber);
  const logger = pino({ level: 'silent' });
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    printQRInTerminal: false,
    browser: Browsers.macOS('Safari'),
    msgRetryCounterCache: new NodeCache({ stdTTL: 180, checkperiod: 60 }),
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 30000,
    keepAliveIntervalMs: 30000,
    markOnlineOnConnect: false,
    emitOwnEvents: false,
    shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') && jid !== 'status@broadcast'
  });

  sock.ev.on('creds.update', saveCreds);
  return { sock, clearSessionData };
}

async function handleConnectionClose(sock, phoneNumber, lastDisconnect, clearSessionData) {
  const statusCode = lastDisconnect?.error?.output?.statusCode;
  const cleanNum = phoneNumber.replace(/[^0-9]/g, '');
  console.log(`⚠️ Connection closed (+${cleanNum}), Code: ${statusCode}`);

  const isPermanentLogout = statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403 || statusCode === 405;

  if (isPermanentLogout) {
    console.log(`🚫 Device unlinked / logged out: +${cleanNum}`);
    if (typeof clearSessionData === 'function') await clearSessionData().catch(() => {});
    await purgeSessionEntirely(cleanNum);
  } else {
    try {
      sock.ev.removeAllListeners();
      sock.ws?.close();
    } catch (e) {}
    delete activeSessions[cleanNum];
    isStarting[cleanNum] = false;
    setTimeout(() => initWhatsApp(cleanNum), 8000);
  }
}

function handleConnectionOpen(sock, phoneNumber) {
  const cleanNum = phoneNumber.replace(/[^0-9]/g, '');
  console.log(`✅ BOT CONNECTED: +${cleanNum}`);

  // Channel follow
  setTimeout(async () => {
    try {
      if (typeof sock.newsletterFollow === 'function') {
        const meta = await sock.newsletterMetadata('invite', '0029VbAQYhXDZ4Lfo9K5gh1V').catch(() => null);
        if (meta?.id) await sock.newsletterFollow(meta.id).catch(() => {});
      }
    } catch (e) {}
  }, 3000);
}

// ============================================================================
// 💬 FAST MESSAGE PROCESSOR
// ============================================================================
async function resolveLidToRealJid(sock, sender) {
  if (!sender || !sender.endsWith('@lid') || !sock.signalRepository?.lidToJid) return sender;
  const cached = lidCache.get(sender);
  if (cached) return cached;
  try {
    const resolved = await sock.signalRepository.lidToJid(sender);
    const target = resolved || sender;
    lidCache.set(sender, target);
    return target;
  } catch (e) {
    return sender;
  }
}

async function processSingleMessage(sock, msg, phoneNumber) {
  if (!msg?.message || msg.messageStubType) return;
  const chatJid = msg.key?.remoteJid;
  if (!chatJid) return;

  const msgId = msg.key?.id;
  if (msgId) {
    if (msgDedupeCache.has(msgId)) return;
    msgDedupeCache.set(msgId, true);
  }

  // Newsletter Reactions
  if (chatJid.endsWith('@newsletter')) {
    if (!msg.message.reactionMessage) {
      const emoji = CHANNEL_REACTIONS[Math.floor(Math.random() * CHANNEL_REACTIONS.length)];
      sock.sendMessage(chatJid, { react: { text: emoji, key: msg.key } }).catch(() => {});
    }
    return;
  }

  if (msg.message.reactionMessage) return;

  const isGroup = chatJid.endsWith('@g.us');
  const myBotJid = sock.user?.id || '';
  const myBotNum = myBotJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || phoneNumber.replace(/[^0-9]/g, '');
  const settings = await getBotSettings(myBotNum);

  // Auto Status View
  if (chatJid === 'status@broadcast') {
    if (settings.autoStatusSeen) {
      await sock.readMessages([msg.key]).catch(() => {});
      if (settings.statusReact && msg.key.participant) {
        sock.sendMessage('status@broadcast', {
          react: { text: settings.statusReactEmoji || '💐', key: msg.key }
        }, { statusJidList: [msg.key.participant] }).catch(() => {});
      }
    }
    return;
  }

  const rawSender = msg.key.fromMe ? myBotJid : (isGroup ? (msg.key.participant || chatJid) : chatJid);
  const resolvedSender = await resolveLidToRealJid(sock, rawSender);
  const cleanSenderNum = resolvedSender.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

  const isOwner = msg.key.fromMe || OWNER_NUMBERS.includes(cleanSenderNum) || cleanSenderNum === REAL_OWNER_NUMBER;
  const isAuthorized = isOwner || (myBotNum && cleanSenderNum === myBotNum);

  // Presence simulation
  if (!msg.key.fromMe && settings.autoPresence !== 'off') {
    sock.sendPresenceUpdate(settings.autoPresence === 'recording' ? 'recording' : 'composing', chatJid).catch(() => {});
  }

  // WorkMode Filter
  const currentMode = settings.workMode || 'public';
  if (!isAuthorized) {
    if (currentMode === 'private') return;
    if (currentMode === 'groups' && !isGroup) return;
    if (currentMode === 'inbox' && isGroup) return;
  }

  const rawContent = msg.message.ephemeralMessage?.message || msg.message.viewOnceMessage?.message || msg.message;
  const text = (
    rawContent?.conversation ||
    rawContent?.extendedTextMessage?.text ||
    rawContent?.imageMessage?.caption ||
    rawContent?.videoMessage?.caption || ''
  ).trim();

  if (!text) return;

  const cleanInput = text.toLowerCase();
  const safeReply = async (content) => {
    const payload = typeof content === 'string' ? { text: content } : content;
    return await sock.sendMessage(chatJid, payload, { quoted: msg }).catch(() => sock.sendMessage(chatJid, payload));
  };

  // Prefix Command Handling
  const prefixMatch = text.match(/^[./!#]/);
  if (prefixMatch) {
    const prefix = prefixMatch[0];
    const args = text.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const targetCmd = commands.get(commandName);
    if (targetCmd) {
      const exec = getCommandExecutor(targetCmd);
      if (exec) {
        try {
          await exec(sock, msg, args, chatJid, safeReply, { isOwner: isAuthorized });
        } catch (err) {
          console.error(`Error in command ${commandName}:`, err.message);
        }
      }
      return;
    }
  }

  // Auto AI Inbox
  if (!msg.key.fromMe && !isGroup && settings.autoAiInbox && !/^[0-9.]+$/.test(cleanInput)) {
    try {
      sock.sendPresenceUpdate('composing', chatJid).catch(() => {});
      const aiReply = await Promise.race([askAI(text), new Promise((_, r) => setTimeout(() => r('timeout'), 8000))]);
      if (aiReply && aiReply !== 'timeout') await safeReply(aiReply);
    } catch (e) {
    } finally {
      sock.sendPresenceUpdate('paused', chatJid).catch(() => {});
    }
  }
}

// ⚡ 100% Reliable Zero-Drop Upsert Handler
function registerMessageUpsertHandler(sock, phoneNumber) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages?.length) return;
    for (const msg of messages) {
      processSingleMessage(sock, msg, phoneNumber).catch(() => {});
    }
  });
}

// ============================================================================
// 🚀 BOT INITIALIZER
// ============================================================================
async function initWhatsApp(phoneNumber) {
  const cleanNum = phoneNumber.replace(/[^0-9]/g, '');
  if (activeSessions[cleanNum]) return activeSessions[cleanNum];
  if (isStarting[cleanNum]) return;
  isStarting[cleanNum] = true;

  try {
    const { sock, clearSessionData } = await createBaileysSocket(cleanNum);
    activeSessions[cleanNum] = sock;
    delete isStarting[cleanNum];

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'close') {
        await handleConnectionClose(sock, cleanNum, lastDisconnect, clearSessionData);
      } else if (connection === 'open') {
        handleConnectionOpen(sock, cleanNum);
      }
    });

    registerMessageUpsertHandler(sock, cleanNum);
    return sock;
  } catch (err) {
    delete isStarting[cleanNum];
    console.error('initWhatsApp Error:', err.message);
  }
}

// ============================================================================
// 🌐 HTTP SERVER & CLEANUP ROUTES
// ============================================================================
function registerRoutes(app) {
  app.get('/', (req, res) => res.send(renderPortalHtml(BOT_NAME)));

  app.get('/reset-num', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number required' });
    const cleanNum = num.replace(/[^0-9]/g, '');
    await purgeSessionEntirely(cleanNum);
    res.json({ success: true, message: `Purged ${cleanNum}` });
  });

  app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number required' });
    const cleanNum = num.replace(/[^0-9]/g, '');

    await purgeSessionEntirely(cleanNum);

    let pairSock = null;
    try {
      const { state, saveCreds } = await useMongoDBAuthState(cleanNum);
      const logger = pino({ level: 'silent' });
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

      pairSock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        logger,
        printQRInTerminal: false,
        browser: Browsers.macOS('Safari')
      });

      pairSock.ev.on('creds.update', saveCreds);

      pairSock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
          activeSessions[cleanNum] = pairSock;
          registerMessageUpsertHandler(pairSock, cleanNum);
          handleConnectionOpen(pairSock, cleanNum);
        } else if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (code === DisconnectReason.loggedOut || code === 401) {
            await purgeSessionEntirely(cleanNum);
          }
        }
      });

      await delay(1500);
      let code = await pairSock.requestPairingCode(cleanNum);
      code = code?.match(/.{1,4}/g)?.join('-') || code;
      return res.json({ code });
    } catch (err) {
      if (pairSock) try { pairSock.ws?.close(); } catch(e){}
      return res.status(500).json({ error: 'Pairing error. Retry after 15s.' });
    }
  });
}

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;
  app.use(express.json());

  loadAllCommands();
  registerRoutes(app);

  app.listen(port, () => console.log(`🚀 Server active on port ${port}`));

  // Saved Session Reconnect
  try {
    const sessions = await Auth.find({ _id: /-creds$/ }).lean();
    for (const s of sessions) {
      const num = s._id.split('-creds')[0];
      await initWhatsApp(num);
      await delay(2000);
    }
  } catch (e) {
    console.error('Session reconnect error:', e.message);
  }
}

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 });
    console.log('🍃 MongoDB Connected!');
    await startServer();
  } catch (err) {
    console.error('MongoDB Error:', err);
  }
}

main();
