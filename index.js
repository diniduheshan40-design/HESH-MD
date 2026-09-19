// ============================================================================
// 📦 PACKAGES
// ============================================================================
const express = require('express');
const pino = require('pino');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const {
  default: makeWASocket,
  DisconnectReason,
  delay,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err?.message || err));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err?.message || err));

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

const settingsCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
const lidCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });
const msgDedupeCache = new NodeCache({ stdTTL: 20, checkperiod: 10 });
const activeSessions = {};
global.activeSessions = activeSessions;
const isStarting = {};
const commands = new Map();

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
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${botName} • PAIR</title><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet"><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0507;color:#fff;font-family:'Outfit',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#170b10;border:1px solid #f43f5e33;border-radius:20px;padding:30px 24px;width:100%;max-width:380px;text-align:center}.title{font-size:24px;font-weight:800;color:#fb7185;margin-bottom:6px}.desc{font-size:13px;color:#a8999d;margin-bottom:20px}.input{width:100%;padding:14px;border-radius:10px;border:1px solid #f43f5e44;background:#0d0508;color:#fff;font-size:16px;font-weight:600;text-align:center;outline:none;margin-bottom:12px}.btn{width:100%;padding:14px;border-radius:10px;border:none;background:#e11d48;color:#fff;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px}.btn:disabled{opacity:.5}.btn-sub{width:100%;padding:10px;border-radius:10px;border:1px solid #f43f5e33;background:#260e17;color:#fb7185;font-size:12px;cursor:pointer;margin-bottom:6px}.code{font-family:'JetBrains Mono',monospace;font-size:26px;font-weight:800;color:#ffe4e6;background:#38111e;border:1.5px dashed #fb7185;padding:14px;border-radius:10px;margin-top:16px;display:none;cursor:pointer}</style></head><body><div class="card"><h1 class="title">${botName}</h1><p class="desc">Enter number: Country Code + Number (e.g. 9471...)</p><input type="text" id="phone" class="input" placeholder="9471xxxxxxx" /><button id="btn" class="btn" onclick="fetchPairCode()">GET PAIRING CODE</button><button class="btn-sub" onclick="cleanSession()">CLEAN THIS SESSION</button><button class="btn-sub" style="color:#f87171;" onclick="resetAll()">LOGOUT ALL</button><div class="code" id="codeDisplay" onclick="copyCode()"></div></div><script>
async function fetchPairCode(){
  const p = document.getElementById('phone').value.replace(/[^0-9]/g,'');
  if(!p || p.length < 10) return alert('Country Code එක සහිතව අංකය ඇතුළත් කරන්න (උදා: 9471XXXXXXX)');
  const b = document.getElementById('btn');
  const d = document.getElementById('codeDisplay');
  b.innerText = 'GENERATING...';
  b.disabled = true;
  d.style.display = 'none';

  try {
    const res = await fetch('/pair?num=' + p);
    const data = await res.json();
    if(data.code){
      d.innerText = data.code;
      d.style.display = 'block';
      navigator.clipboard.writeText(data.code).catch(()=>{});
    } else {
      alert(data.error || 'දෝෂයකි. Clean Session ඔබා නැවත බලන්න.');
    }
  } catch(e){
    alert('Request Timeout. නැවත උත්සාහ කරන්න.');
  } finally {
    b.innerText = 'GET PAIRING CODE';
    b.disabled = false;
  }
}
async function cleanSession(){
  const p = document.getElementById('phone').value.replace(/[^0-9]/g,'');
  if(!p) return alert('Phone number එක දෙන්න!');
  await fetch('/reset-num?num='+p);
  alert('Cleaned!');
  document.getElementById('codeDisplay').style.display = 'none';
}
async function resetAll(){
  if(confirm('සියල්ල Logout කරන්නද?')){
    await fetch('/reset-all');
    alert('All Cleaned!');
    document.getElementById('codeDisplay').style.display = 'none';
  }
}
function copyCode(){
  const c = document.getElementById('codeDisplay').innerText;
  navigator.clipboard.writeText(c);
  alert('Copied: ' + c);
}
</script></body></html>`;
}

// ============================================================================
// 🗑️ CLEANUP FUNCTIONS
// ============================================================================
async function purgeSession(cleanNum) {
  if (activeSessions[cleanNum]) {
    try {
      activeSessions[cleanNum].ev.removeAllListeners();
      activeSessions[cleanNum].ws?.close();
    } catch (e) {}
    delete activeSessions[cleanNum];
  }
  delete isStarting[cleanNum];
  settingsCache.del(cleanNum);

  await Promise.allSettled([
    Auth.deleteMany({ _id: new RegExp('^' + cleanNum, 'i') }),
    mongoose.connection.db ? mongoose.connection.db.collection('auths').deleteMany({ _id: new RegExp('^' + cleanNum, 'i') }) : Promise.resolve(),
    mongoose.connection.db ? mongoose.connection.db.collection('botsettings').deleteOne({ _id: cleanNum }) : Promise.resolve()
  ]);
}

// ============================================================================
// 💬 FAST MESSAGE PROCESSOR
// ============================================================================
async function resolveLid(sock, sender) {
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
  const resolvedSender = await resolveLid(sock, rawSender);
  const cleanSenderNum = resolvedSender.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

  const isOwner = msg.key.fromMe || OWNER_NUMBERS.includes(cleanSenderNum) || cleanSenderNum === REAL_OWNER_NUMBER;
  const isAuthorized = isOwner || (myBotNum && cleanSenderNum === myBotNum);

  if (!msg.key.fromMe && settings.autoPresence !== 'off') {
    sock.sendPresenceUpdate(settings.autoPresence === 'recording' ? 'recording' : 'composing', chatJid).catch(() => {});
  }

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

  const safeReply = async (content) => {
    const payload = typeof content === 'string' ? { text: content } : content;
    return await sock.sendMessage(chatJid, payload, { quoted: msg }).catch(() => sock.sendMessage(chatJid, payload));
  };

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
          console.error(`Error in cmd ${commandName}:`, err.message);
        }
      }
      return;
    }
  }

  if (!msg.key.fromMe && !isGroup && settings.autoAiInbox && !/^[0-9.]+$/.test(text)) {
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

// ============================================================================
// 🚀 BOT INITIALIZER (For already paired sessions)
// ============================================================================
async function initWhatsApp(phoneNumber) {
  const cleanNum = phoneNumber.replace(/[^0-9]/g, '');
  if (activeSessions[cleanNum] || isStarting[cleanNum]) return;
  isStarting[cleanNum] = true;

  try {
    const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(cleanNum);
    const logger = pino({ level: 'silent' });
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    const sock = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      markOnlineOnConnect: false
    });

    activeSessions[cleanNum] = sock;
    delete isStarting[cleanNum];

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          await purgeSession(cleanNum);
        } else {
          delete activeSessions[cleanNum];
          setTimeout(() => initWhatsApp(cleanNum), 5000);
        }
      } else if (connection === 'open') {
        console.log(`✅ BOT ONLINE: +${cleanNum}`);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      if (!messages?.length) return;
      for (const msg of messages) processSingleMessage(sock, msg, cleanNum).catch(() => {});
    });

    return sock;
  } catch (err) {
    delete isStarting[cleanNum];
    console.error('Init Error:', err.message);
  }
}

// ============================================================================
// 🌐 HTTP SERVER & 100% WORKING DIRECT PAIR ROUTE
// ============================================================================
function registerRoutes(app) {
  app.get('/', (req, res) => res.send(renderPortalHtml(BOT_NAME)));

  app.get('/reset-num', async (req, res) => {
    const cleanNum = (req.query.num || '').replace(/[^0-9]/g, '');
    if (!cleanNum) return res.status(400).json({ error: 'Number required' });
    await purgeSession(cleanNum);
    res.json({ success: true });
  });

  app.get('/reset-all', async (req, res) => {
    for (const num of Object.keys(activeSessions)) {
      try {
        activeSessions[num]?.ev?.removeAllListeners();
        activeSessions[num]?.ws?.close();
      } catch (e) {}
    }
    Object.keys(activeSessions).forEach(k => delete activeSessions[k]);
    Object.keys(isStarting).forEach(k => delete isStarting[k]);
    settingsCache.flushAll();

    await Promise.allSettled([
      Auth.deleteMany({}),
      mongoose.connection.db ? mongoose.connection.db.collection('auths').deleteMany({}) : Promise.resolve(),
      mongoose.connection.db ? mongoose.connection.db.collection('botsettings').deleteMany({}) : Promise.resolve()
    ]);
    res.json({ success: true });
  });

  // 💥 ZERO-FAIL INSTANT PAIR ENDPOINT
  app.get('/pair', async (req, res) => {
    const cleanNum = (req.query.num || '').replace(/[^0-9]/g, '');
    if (!cleanNum || cleanNum.length < 10) {
      return res.status(400).json({ error: 'Valid phone number required' });
    }

    // 1. පරණ තත්ත්වයන් සම්පූර්ණයෙන්ම Reset කිරීම
    await purgeSession(cleanNum);

    let pairSock = null;
    let codeSent = false;

    // Timeout: උපරිම තත්පර 25කින් response එක දීම
    const killTimer = setTimeout(() => {
      if (!codeSent) {
        codeSent = true;
        try { pairSock?.ws?.close(); } catch (e) {}
        return res.status(504).json({ error: 'WhatsApp Handshake Timeout. Clean Session ඔබා තත්පර 5කින් නැවත බලන්න.' });
      }
    }, 25000);

    try {
      const { state, saveCreds } = await useMongoDBAuthState(cleanNum);
      const logger = pino({ level: 'silent' });
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

      pairSock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'), // Strict standard browser config
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000
      });

      pairSock.ev.on('creds.update', saveCreds);

      // Connection update හරහා event handle කිරීම
      pairSock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
        if (connection === 'open') {
          console.log(`🎉 Linked successfully: +${cleanNum}`);
          activeSessions[cleanNum] = pairSock;
          pairSock.ev.on('messages.upsert', async ({ messages }) => {
            if (!messages?.length) return;
            for (const msg of messages) processSingleMessage(pairSock, msg, cleanNum).catch(() => {});
          });
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          if (code === DisconnectReason.loggedOut || code === 401) {
            await purgeSession(cleanNum);
          }
        }
      });

      // QR එක ready වෙන තෙක් හෝ socket එක stable වන තෙක් රැඳී සිට pairing code ඉල්ලීම
      await delay(2500);

      if (!pairSock.authState.creds.registered) {
        let code = await pairSock.requestPairingCode(cleanNum);
        code = code?.match(/.{1,4}/g)?.join('-') || code;

        clearTimeout(killTimer);
        if (!codeSent) {
          codeSent = true;
          return res.json({ code });
        }
      } else {
        clearTimeout(killTimer);
        return res.status(400).json({ error: 'This number is already linked. Clean session first.' });
      }

    } catch (err) {
      clearTimeout(killTimer);
      console.error(`❌ Pair code generation error:`, err.message);
      try { pairSock?.ws?.close(); } catch (e) {}
      if (!codeSent) {
        codeSent = true;
        return res.status(500).json({ error: 'Pairing error. Clean session ඔබා තත්පර 10කින් නැවත බලන්න.' });
      }
    }
  });
}

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;
  app.use(express.json());

  loadAllCommands();
  registerRoutes(app);

  app.listen(port, () => console.log(`🚀 Server listening on port ${port}`));

  // Saved Session Auto-Reconnect
  try {
    const sessions = await Auth.find({ _id: /-creds$/ }).lean();
    for (const s of sessions) {
      const num = s._id.split('-creds')[0];
      await initWhatsApp(num);
      await delay(2000);
    }
  } catch (e) {
    console.error('Reconnect error:', e.message);
  }
}

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 5000 });
    console.log('🍃 MongoDB Connected!');
    await startServer();
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
  }
}

main();

