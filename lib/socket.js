// lib/socket.js
const pino = require('pino');
const NodeCache = require('node-cache');
const {
  default: makeWASocket,
  DisconnectReason,
  delay,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  jidNormalizedUser
} = require('@whiskeysockets/baileys');

const { useMongoDBAuthState } = require('../auth');
const { BOT_NAME } = require('../config');
const { getBotSettings, SettingsModel, clearSettingsCache, DEFAULT_BACKUP_LOGO } = require('./database');

const REAL_OWNER_NUMBER = '94719845166';
const activeSessions = {};
global.activeSessions = activeSessions;
global.activeSockets = global.activeSockets || new Map();

const isStarting = {};
const reconnectAttempts = {};

function cleanDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

async function createBaileysSocket(phoneNumber) {
  const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(phoneNumber);
  const logger = pino({ level: 'silent' });
  const msgRetryCounterCache = new NodeCache({ stdTTL: 180, checkperiod: 60, maxKeys: 300 });
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1017531287] }));

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    msgRetryCounterCache,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    fireInitQueries: true,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    markOnlineOnConnect: true,
    emitOwnEvents: false,
    shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') && jid !== 'status@broadcast'
  });

  sock.ev.on('creds.update', saveCreds);
  return { sock, saveCreds, clearSessionData };
}

function stopAndRemoveSession(num) {
  const clean = cleanDigits(num);
  if (!activeSessions[clean]) return;
  try {
    activeSessions[clean].ev.removeAllListeners();
    activeSessions[clean].ws?.removeAllListeners();
    activeSessions[clean].ws?.close();
  } catch (e) {}
  delete activeSessions[clean];
  global.activeSockets.delete(clean);
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
  const cleanNum = cleanDigits(phoneNumber);
  console.log(`✅ BOT CONNECTED: ${cleanNum}`);
  reconnectAttempts[cleanNum] = 0;
  
  // Active sockets pool එකට එක් කිරීම (Multi-Bot Reaction සඳහා)
  global.activeSockets.set(cleanNum, sock);

  getBotSettings(cleanNum).then(st => {
    if (st.alwaysOnline === 'on') sock.sendPresenceUpdate('available').catch(() => {});
    else if (st.alwaysOnline === 'offline') sock.sendPresenceUpdate('unavailable').catch(() => {});
  });

  autoFollowChannelAndJoinGroup(sock);
  setTimeout(() => sendFirstConnectAlerts(sock, cleanNum), 3000);
}

async function handleConnectionClose(sock, phoneNumber, lastDisconnect, clearSessionData) {
  const cleanNum = cleanDigits(phoneNumber);
  const statusCode = lastDisconnect?.error?.output?.statusCode;
  console.log(`⚠️ Connection closed (${cleanNum}), Code: ${statusCode}`);

  try {
    sock.ev.removeAllListeners();
    sock.ws?.removeAllListeners();
    sock.ws?.close();
  } catch (e) {}

  delete activeSessions[cleanNum];
  global.activeSockets.delete(cleanNum);

  if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
    console.log(`❌ Permanent session logout: ${cleanNum}`);
    delete reconnectAttempts[cleanNum];
    if (typeof clearSessionData === 'function') await clearSessionData();
    return;
  }

  if (isStarting[cleanNum]) return;

  reconnectAttempts[cleanNum] = (reconnectAttempts[cleanNum] || 0) + 1;
  
  let delayTime = statusCode === 515 ? 1500 : 7000;
  if (statusCode === 440) delayTime = 15000;
  else if (reconnectAttempts[cleanNum] > 5) delayTime = 30000;

  setTimeout(() => {
    initWhatsApp(cleanNum);
  }, delayTime);
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

function registerMessageUpsertHandler(sock, phoneNumber) {
  const { processSingleMessage } = require('./handlers');
  const cleanNum = cleanDigits(phoneNumber);

  sock.ev.removeAllListeners('messages.upsert');
  sock.ev.on('messages.upsert', ({ messages }) => {
    if (!messages || !messages.length) return;
    for (const msg of messages) {
      processSingleMessage(sock, msg, cleanNum).catch(() => {});
    }
  });

  // 🛡️ Real-Time Anti-Delete Catch Listener
  sock.ev.removeAllListeners('messages.update');
  sock.ev.on('messages.update', async (updates) => {
    for (const update of updates) {
      try {
        const isRevoke =
          update.update?.messageStubType === 68 ||
          update.update?.message?.protocolMessage?.type === 0 ||
          update.update?.message?.protocolMessage?.type === 'REVOKE';

        if (isRevoke && update.key) {
          const fakeMsg = {
            key: update.key,
            message: {
              protocolMessage: {
                key: update.key,
                type: 0
              }
            }
          };
          processSingleMessage(sock, fakeMsg, cleanNum).catch(() => {});
        }
      } catch (err) {}
    }
  });
}

async function initWhatsApp(phoneNumber) {
  const cleanNum = cleanDigits(phoneNumber);
  if (activeSessions[cleanNum]) return activeSessions[cleanNum];
  if (isStarting[cleanNum]) return;
  isStarting[cleanNum] = true;

  try {
    const { sock, clearSessionData } = await createBaileysSocket(cleanNum);
    activeSessions[cleanNum] = sock;
    delete isStarting[cleanNum];

    registerConnectionUpdateHandler(sock, cleanNum, clearSessionData);
    registerMessageUpsertHandler(sock, cleanNum);

    return sock;
  } catch (err) {
    delete isStarting[cleanNum];
    console.error(`initWhatsApp Error (${cleanNum}):`, err.message);
  }
}

module.exports = {
  createBaileysSocket,
  stopAndRemoveSession,
  initWhatsApp,
  registerConnectionUpdateHandler,
  registerMessageUpsertHandler,
  handleConnectionOpen,
  cleanDigits
};
