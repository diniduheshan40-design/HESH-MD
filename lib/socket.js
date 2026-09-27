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
const isStarting = {};
const reconnectAttempts = {};

function cleanDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

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

function stopAndRemoveSession(num) {
  if (!activeSessions[num]) return;
  try {
    activeSessions[num].ev.removeAllListeners();
    activeSessions[num].ws?.removeAllListeners();
    activeSessions[num].ws?.close();
  } catch (e) {}
  delete activeSessions[num];
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

  if (statusCode === 440) delayTime = 15000;
  else if (reconnectAttempts[phoneNumber] > 5) delayTime = 30000;

  setTimeout(() => {
    initWhatsApp(phoneNumber);
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
  sock.ev.removeAllListeners('messages.upsert');
  sock.ev.on('messages.upsert', ({ messages }) => {
    if (!messages || !messages.length) return;
    for (const msg of messages) {
      processSingleMessage(sock, msg, phoneNumber).catch(() => {});
    }
  });
}

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

module.exports = {
  createBaileysSocket,
  stopAndRemoveSession,
  initWhatsApp,
  registerConnectionUpdateHandler,
  registerMessageUpsertHandler,
  handleConnectionOpen,
  cleanDigits
};
