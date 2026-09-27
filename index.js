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
  downloadContentFromMessage
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

// ⚡ Global Newsletter Forward Context Injection
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

const REAL_OWNER_NUMBER = '94719845166';
const OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '15947733680169@lid',
  '72787431583987',
  '72787431583987@lid'
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
          --panel-card: rgba(18, 5, 8, 0.78);
          --neon-red: #ff003c;
          --deep-red: #990024;
          --crimson-glow: rgba(255, 0, 60, 0.45);
          --card-border: rgba(255, 0, 60, 0.28);
          --input-bg: rgba(10, 2, 4, 0.85);
          --text-bright: #ffffff;
          --text-dim: #a89498;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
        body {
          background-color: var(--bg-black);
          background-image: 
            radial-gradient(circle at 50% 0%, rgba(255, 0, 60, 0.22) 0%, transparent 55%),
            radial-gradient(circle at 100% 100%, rgba(153, 0, 36, 0.18) 0%, transparent 50%),
            radial-gradient(circle at 0% 100%, rgba(255, 0, 60, 0.12) 0%, transparent 45%);
          color: var(--text-bright);
          font-family: 'Outfit', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow-x: hidden;
        }
        .portal-container { width: 100%; max-width: 430px; position: relative; }
        .portal-card {
          background: var(--panel-card);
          backdrop-filter: blur(30px) saturate(180%);
          -webkit-backdrop-filter: blur(30px) saturate(180%);
          border: 1px solid var(--card-border);
          border-radius: 28px;
          padding: 44px 32px;
          text-align: center;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.85), 0 0 35px rgba(255, 0, 60, 0.2);
          position: relative;
        }
        .brand-title {
          font-size: 32px;
          font-weight: 900;
          letter-spacing: -0.5px;
          text-transform: uppercase;
          background: linear-gradient(135deg, #ffffff 30%, #ff8097 70%, var(--neon-red) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 6px;
        }
        .brand-subtitle { color: var(--text-dim); font-size: 13.5px; margin-bottom: 32px; }
        .field-group { margin-bottom: 20px; position: relative; }
        .phone-field {
          width: 100%;
          padding: 18px 22px;
          background: var(--input-bg);
          border: 1.5px solid var(--card-border);
          border-radius: 18px;
          color: #ffffff;
          font-size: 18px;
          font-weight: 700;
          text-align: center;
          outline: none;
        }
        .phone-field:focus { border-color: var(--neon-red); }
        .btn-generate {
          width: 100%;
          padding: 18px;
          border: none;
          border-radius: 18px;
          background: linear-gradient(135deg, var(--deep-red) 0%, var(--neon-red) 100%);
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
        }
        .code-panel { display: none; margin-top: 26px; }
        .code-display {
          font-family: 'JetBrains Mono', monospace;
          font-size: 34px;
          font-weight: 800;
          color: #ffffff;
          background: rgba(255, 0, 60, 0.12);
          border: 2px dashed rgba(255, 0, 60, 0.55);
          border-radius: 18px;
          padding: 18px;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="portal-container">
        <div class="portal-card">
          <h1 class="brand-title">${botName}</h1>
          <p class="brand-subtitle">Enter WhatsApp number with country code</p>
          <div class="field-group">
            <input type="tel" id="phone" class="phone-field" placeholder="e.g. 9471xxxxxxx" autofocus />
          </div>
          <button id="genBtn" class="btn-generate" onclick="generatePairCode()">GENERATE PAIR CODE</button>
          <div class="code-panel" id="codePanel">
            <div class="code-display" id="codeDisplay"></div>
          </div>
        </div>
      </div>
      <script>
        async function generatePairCode() {
          const cleanPhone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
          if (!cleanPhone || cleanPhone.length < 10) return alert('Enter valid number with country code!');
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
            } else {
              alert(data.error || 'Rate limited. Wait a few seconds.');
            }
          } catch(e) { alert('Server error'); }
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
// 🔌 SOCKET CREATION (CRASH-PROOF & LEAN)
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
// 💬 MESSAGE HANDLING & ANTI-DELETE ENGINE
// ============================================================================

function resolveOriginalSender(msg, chatJid, isGroup, myBotJid) {
  if (msg.key.fromMe) return myBotJid;
  if (isGroup) return msg.key?.participant || msg.participant || '';
  return chatJid;
}

async function resolveLidToRealJid(sock, originalSender) {
  if (!originalSender || !originalSender.endsWith('@lid') || !sock.signalRepository?.lidToJid) {
    return originalSender;
  }
  try {
    const resolved = await sock.signalRepository.lidToJid(originalSender);
    return resolved || originalSender;
  } catch (e) {
    return originalSender;
  }
}

function isOwnerJid(jid) {
  if (!jid) return false;
  const str = String(jid).toLowerCase();
  return OWNER_NUMBERS.some(owner => str.includes(owner.toLowerCase()));
}

function checkIsOwner(originalSender, resolvedSender) {
  return isOwnerJid(originalSender) || isOwnerJid(resolvedSender);
}

function checkIsAuthorizedToControl(isOwner, msg, myBotNum, cleanSenderNum) {
  return isOwner || msg.key.fromMe || (Boolean(myBotNum) && cleanSenderNum === myBotNum);
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
    ''
  ).trim();
}

function buildSafeReply(sock, chatJid, msg) {
  return async (content) => {
    let replyPayload = typeof content === 'string' ? { text: content } : { ...content };
    replyPayload.contextInfo = { ...(replyPayload.contextInfo || {}), ...(global.channelContext?.contextInfo || {}) };
    try {
      return await sock.sendMessage(chatJid, replyPayload, { quoted: msg });
    } catch (e) {
      return await sock.sendMessage(chatJid, replyPayload);
    }
  };
}

function extractQuotedCaption(quotedMsgObj) {
  return (
    quotedMsgObj?.imageMessage?.caption ||
    quotedMsgObj?.videoMessage?.caption ||
    quotedMsgObj?.conversation ||
    quotedMsgObj?.extendedTextMessage?.text ||
    ''
  );
}

// ============================================================================
// 💬 SINGLE MESSAGE PROCESSOR
// ============================================================================

async function processSingleMessage(sock, msg, phoneNumber) {
  if (!msg || !msg.message) return;
  const chatJid = msg.key?.remoteJid;
  if (!chatJid) return;

  const isGroup = chatJid.endsWith('@g.us');
  const myBotJid = sock.user?.id || '';
  const myBotNum = myBotJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || phoneNumber.replace(/[^0-9]/g, '');

  const rawMsg = unwrapMessageContent(msg.message);
  const text = extractMessageText(rawMsg);
  if (!text || msg.message.reactionMessage) return;

  const cleanInput = text.toLowerCase().trim();
  const safeReply = buildSafeReply(sock, chatJid, msg);

  const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
  const quotedMsgObj = quotedContext?.quotedMessage;
  const quotedCaption = extractQuotedCaption(quotedMsgObj);
  const quotedMsgId = quotedContext?.stanzaId;

  // 🛡️ Track Song Card Replying
  const isSongCardReply = quotedCaption.includes('TRACK INFO') || 
                          quotedCaption.includes('SELECT FORMAT') || 
                          quotedCaption.includes('HESHAN AUDIO BEATS') ||
                          quotedCaption.includes('AUDIO (MP3)');

  const hasSongSession = isSongCardReply || 
                         (quotedMsgId && global.songSessions?.has(quotedMsgId)) || 
                         global.songSessions?.has(chatJid);

  // ============================================================================
  // 🎵 1. CRASH-PROOF STREAMING SONG DOWNLOADER (NO RAM BUFFER OVERLOAD)
  // ============================================================================
  if (hasSongSession && ['1', '2', '3'].includes(cleanInput)) {
    const session = (quotedMsgId && global.songSessions.get(quotedMsgId)) || global.songSessions.get(chatJid);

    if (session && session.videoUrl) {
      if (quotedMsgId) global.songSessions.delete(quotedMsgId);
      global.songSessions.delete(chatJid);

      await sock.sendMessage(chatJid, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      try {
        const apiKey = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';
        const targetUrl = encodeURIComponent(session.videoUrl);
        const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${targetUrl}&quality=320kbps&format=mp3&api_key=${apiKey}`;

        const res = await axios.get(apiUrl, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });

        const dlUrl = res.data?.download_url || 
                      res.data?.direct_url || 
                      res.data?.data?.download_url || 
                      res.data?.data?.direct_url;

        if (!dlUrl) {
          throw new Error('Download URL not found in API response.');
        }

        await sock.sendMessage(chatJid, { react: { text: "⬇️", key: msg.key } }).catch(() => {});

        const songTitle = session.title || res.data?.title || res.data?.data?.title || 'Song';

        // ⚠️ RAM Overload Fix: Stream directly via URL to Baileys without loading into Node Buffer
        if (cleanInput === '1') {
          // [1] Playable Audio MP3
          await sock.sendMessage(chatJid, {
            audio: { url: dlUrl },
            mimetype: 'audio/mp4',
            fileName: `${songTitle}.mp3`,
            ptt: false,
            contextInfo: {
              externalAdReply: {
                title: songTitle,
                body: 'HESHAN-MD AUDIO ENGINE',
                thumbnailUrl: session.thumb || res.data?.thumbnail,
                sourceUrl: session.videoUrl,
                mediaType: 2,
                renderLargerThumbnail: true
              }
            }
          }, { quoted: msg });
        } else if (cleanInput === '2') {
          // [2] Document File
          await sock.sendMessage(chatJid, {
            document: { url: dlUrl },
            mimetype: 'audio/mpeg',
            fileName: `${songTitle}.mp3`,
            contextInfo: global.channelContext?.contextInfo
          }, { quoted: msg });
        } else if (cleanInput === '3') {
          // [3] Voice Note
          await sock.sendMessage(chatJid, {
            audio: { url: dlUrl },
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
          }, { quoted: msg });
        }

        await sock.sendMessage(chatJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return;
      } catch (e) {
        console.error('Song Stream Error:', e?.message || e);
        await sock.sendMessage(chatJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        await sock.sendMessage(chatJid, { 
          text: `❌ *ගීතය ලබාගැනීමේදී දෝෂයක් මතු විය!* (${e?.message || 'Server Timeout'})`,
          contextInfo: global.channelContext?.contextInfo
        }, { quoted: msg });
        return;
      }
    }
  }

  // ============================================================================
  // ⚙️ 2. SETTINGS MENU EXECUTOR
  // ============================================================================
  const originalSender = resolveOriginalSender(msg, chatJid, isGroup, myBotJid);
  const resolvedSender = await resolveLidToRealJid(sock, originalSender);
  const isOwner = checkIsOwner(originalSender, resolvedSender);
  const cleanSenderNum = (resolvedSender || originalSender || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  const isAuthorized = checkIsAuthorizedToControl(isOwner, msg, myBotNum, cleanSenderNum);

  const isSettingsCmdPattern = cleanInput.startsWith('set ') || 
                               cleanInput.startsWith('pin ') || 
                               cleanInput.startsWith('antisend ') || 
                               cleanInput.startsWith('antidel ') ||
                               /^([1-9]|1[0-2])\.[1-4]$/.test(cleanInput);

  const fromSettingsMenu = quotedCaption.includes('HESHAN-MD SYSTEM SETTINGS') || quotedCaption.includes('SYSTEM SETTINGS');

  if (isAuthorized && !isSongCardReply && (fromSettingsMenu || isSettingsCmdPattern)) {
    const settingsCmd = findCommand('settings', 'setting', 'set');
    if (settingsCmd) {
      const cmdFunc = getCommandExecutor(settingsCmd);
      if (cmdFunc) {
        await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: isAuthorized });
        clearSettingsCache(myBotNum);
        return;
      }
    }
  }

  // ============================================================================
  // ⚡ 3. STANDARD PREFIX COMMANDS (.song, .menu, etc.)
  // ============================================================================
  const prefixMatch = text.match(/^[./!#]/);
  if (!prefixMatch) return;

  const prefix = prefixMatch[0];
  const args = text.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  let targetCmd = commands.get(commandName);
  if (!targetCmd && ['setting', 'settings', 'set', 'config'].includes(commandName)) {
    targetCmd = findCommand('settings', 'setting', 'set');
  }

  if (targetCmd) {
    const cmdFunc = getCommandExecutor(targetCmd);
    if (cmdFunc) {
      try {
        await cmdFunc(sock, msg, args, chatJid, safeReply, { isOwner: isAuthorized, isGroup });
      } catch (err) {
        console.error(`Command [${commandName}] execution error:`, err?.message);
      }
    }
  }
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

function registerPairRoute(app) {
  app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number required' });
    num = num.replace(/[^0-9]/g, '');

    stopAndRemoveSession(num);
    await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
    await SettingsModel.findByIdAndUpdate(num, { $set: { isFirstConnectDone: false } }, { upsert: true }).catch(() => {});
    clearSettingsCache(num);

    let pairSock = null;

    try {
      const { state, saveCreds } = await useMongoDBAuthState(num);
      const logger = pino({ level: 'silent' });
      const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

      pairSock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        logger,
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'),
        connectTimeoutMs: 35000,
        defaultQueryTimeoutMs: 30000,
        keepAliveIntervalMs: 25000,
        markOnlineOnConnect: false,
        emitOwnEvents: false
      });

      pairSock.ev.on('creds.update', saveCreds);

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
  registerPairRoute(app);
}

function startKeepAlivePing() {
  const keepAliveUrl = process.env.RENDER_EXTERNAL_URL;
  if (!keepAliveUrl) return;
  setInterval(async () => {
    try { await fetch(keepAliveUrl); } catch (e) {}
  }, 2 * 60 * 1000);
}

async function reconnectAllSavedSessions() {
  try {
    const sessions = await Auth.find({ _id: /-creds$/ }).lean();
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
