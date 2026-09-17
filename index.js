// ============================================================================
// 📦 PACKAGES (අවශ්‍ය libraries import කරගැනීම)
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

// 🟢 Config & DB Models (අපේම වෙනම files වලින් ගන්නා දේවල්)
const { MONGODB_URI, BOT_NAME } = require('./config');
const { useMongoDBAuthState, Auth } = require('./auth');
const { askAI } = require('./ai');

// ============================================================================
// 🌍 GLOBAL CONSTANTS (වෙනස් නොවන settings/values)
// ============================================================================

// bot එකේ update channel එකට react කරන emoji සහ channel id එක
const UPDATE_CHANNEL_JID = '120363421906774107@newsletter';
const CHANNEL_REACTIONS = ['🥰', '👍', '❤️', '😗', '😯', '🪄', '✨'];

// bot logo එකක් settings වල නැත්නම් default එකක් පාවිච්චි කරන්න
const DEFAULT_BACKUP_LOGO = 'https://files.catbox.moe/a58add.jpeg';

// bot එකේ "owner" ලෙස treat වෙන ෆෝන් number ටික
const REAL_OWNER_NUMBER = '94719845166';
const OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '15947733680169@lid',
  '72787431583987',
  '72787431583987@lid'
];

// bot එකේ default settings object එක (settingsSchema එකේ default values වලට සමානම)
const DEFAULT_SETTINGS = {
  workMode: 'public',
  autoAiInbox: true,
  autoStatusSeen: true,
  statusReact: true,
  statusReactEmoji: '💐',
  ownerReact: true,
  ownerReactEmoji: '👑',
  botLogo: DEFAULT_BACKUP_LOGO,
  autoPresence: 'off',
  securityPin: '1234',
  isFirstConnectDone: false
};

// ============================================================================
// 🧠 RUNTIME STATE (program එක run වෙනකොට වෙනස් වන values ටික)
// ============================================================================

// per-bot settings ටික RAM එකේ cache කරගන්න (DB එකට හැම වතාවෙම query නොකරන්න)
const settingsCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// දැනට connect වෙලා ඉන්න socket instances ටික තියෙන object එක
// key = phoneNumber, value = baileys socket
const activeSessions = {};

// duplicate connection attempt වළක්වගන්න flag object එකක්
const isStarting = {};

// commands/ folder එකේ load කරගත්තු commands ටික තියෙන Map එක
const commands = new Map();

// ============================================================================
// 🗄️ DATABASE SCHEMA & HELPERS (MongoDB settings collection)
// ============================================================================

function createSettingsModel() {
  const SettingsSchema = new mongoose.Schema({
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
  });

  // model එක දැනටමත් register වෙලා නම් ඒකම පාවිච්චි කරන්න, නැත්නම් අලුතින් හදන්න
  return mongoose.models.BotSettings || mongoose.model('BotSettings', SettingsSchema);
}

const SettingsModel = createSettingsModel();

// cache එකෙන් එක number එකක settings clear කරන helper එක
function clearSettingsCache(num) {
  settingsCache.del(num);
}

// bot number එකකට settings ටික ලබාගන්නවා (cache → DB → default, මේ order එකෙන්)
async function getBotSettings(botNum) {
  if (!botNum) return {};

  const cached = settingsCache.get(botNum);
  if (cached) return cached;

  try {
    let settings = await SettingsModel.findById(botNum).lean();

    if (!settings) {
      console.log(`🍃 [${botNum}] Creating default database record...`);
      const created = await SettingsModel.create({ _id: botNum, ...DEFAULT_SETTINGS });
      settings = created.toObject();
    }

    settingsCache.set(botNum, settings);
    return settings;
  } catch (e) {
    console.error(`❌ Error loading settings for ${botNum}:`, e.message);
    // DB එකෙන් error එකක් ආවොත් වත් bot එක නවත්තන්නෙ නෑ, default settings දෙනවා
    return { ...DEFAULT_SETTINGS };
  }
}

// ============================================================================
// 📂 COMMAND LOADER (commands/ folder එකෙන් command files load කිරීම)
// ============================================================================

function registerCommandAliases(cmd, cmdName) {
  if (cmd && cmd.name) {
    commands.set(cmd.name.toLowerCase(), cmd);
  }
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

    console.log(`✅ Loaded command: .${cmdName}`);
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

// commands Map එකෙන් command එකක් සොයාගන්නවා (settings/setting/set වගේ aliases වලට)
function findCommand(...names) {
  for (const name of names) {
    const cmd = commands.get(name);
    if (cmd) return cmd;
  }
  return null;
}

// command object එකක් function එකක්ම වුනත්, .execute/.run object property එකක් වුනත්
// දෙකම handle කරලා ක්‍රියාත්මක කරන්න පුළුවන් function එකක් return කරනවා
function getCommandExecutor(cmd) {
  if (typeof cmd === 'function') return cmd;
  if (cmd && typeof cmd.execute === 'function') return cmd.execute;
  if (cmd && typeof cmd.run === 'function') return cmd.run;
  if (cmd && typeof cmd.downloadAndSendStatus === 'function') return cmd.downloadAndSendStatus;
  return null;
}

// ============================================================================
// 🌐 WEB PORTAL (browser එකෙන් pairing code ගන්න UI එක)
// ============================================================================

function renderPortalHtml(botName) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${botName} • PORTAL</title>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Poppins:wght@400;600&family=JetBrains+Mono:wght@800&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #050102;
          background-image: radial-gradient(circle at 50% 0%, rgba(225, 29, 72, 0.25) 0%, transparent 70%);
          color: #fff; font-family: 'Poppins', sans-serif;
          display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px;
        }
        .glass-panel {
          background: rgba(18, 5, 8, 0.8);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(225, 29, 72, 0.3);
          border-radius: 24px; padding: 40px 30px; width: 100%; max-width: 420px; text-align: center;
          box-shadow: 0 0 35px rgba(225, 29, 72, 0.2);
        }
        .title {
          font-family: 'Orbitron', sans-serif; font-size: 26px; font-weight: 900;
          background: linear-gradient(135deg, #fff, #ff4d6d, #e11d48);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px;
        }
        .subtitle { font-size: 13px; color: #a1a1aa; margin-bottom: 25px; }
        input {
          width: 100%; padding: 16px; border-radius: 14px; border: 1px solid rgba(225, 29, 72, 0.3);
          background: rgba(10, 2, 4, 0.8); color: #ff4d6d; font-size: 16px; text-align: center;
          margin-bottom: 20px; outline: none; transition: 0.3s;
        }
        input:focus { border-color: #e11d48; box-shadow: 0 0 15px rgba(225, 29, 72, 0.4); }
        button {
          width: 100%; padding: 16px; border-radius: 14px; border: none;
          background: linear-gradient(135deg, #b91c1c, #e11d48); color: #fff;
          font-size: 15px; font-weight: 700; cursor: pointer; margin-bottom: 12px; transition: 0.3s;
        }
        button:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(225, 29, 72, 0.5); }
        .btn-reset-num { background: rgba(225, 29, 72, 0.2); border: 1px solid rgba(225, 29, 72, 0.4); color: #fff; }
        .code-display {
          font-family: 'JetBrains Mono', monospace; font-size: 30px; font-weight: 800;
          color: #ff2a55; letter-spacing: 5px; margin-top: 25px; display: none;
          background: rgba(225, 29, 72, 0.08); padding: 15px; border-radius: 12px; border: 1px dashed rgba(225, 29, 72, 0.4);
        }
      </style>
    </head>
    <body>
      <div class="glass-panel">
        <h1 class="title">${botName}</h1>
        <p class="subtitle">Enter WhatsApp number with country code</p>
        <input type="text" id="phone" placeholder="9470xxxxxxx" />
        <button id="btn" onclick="getCode()">GENERATE PAIR CODE</button>
        <button class="btn-reset-num" onclick="resetSingleNumber()">CLEAN THIS NUMBER SESSION</button>
        <div class="code-display" id="codeBox"></div>
      </div>
      <script>
        async function getCode() {
          const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
          if (!phone) return alert('Please enter number!');
          const btn = document.getElementById('btn');
          btn.innerText = 'GENERATING CODE...';
          btn.disabled = true;
          try {
            const res = await fetch('/pair?num=' + phone);
            const data = await res.json();
            if (data.code) {
              const codeElement = document.getElementById('codeBox');
              codeElement.innerText = data.code;
              codeElement.style.display = 'block';
              navigator.clipboard.writeText(data.code);
              alert('✅ Pairing code copied: ' + data.code);
            } else {
              alert(data.error || 'Failed to get code');
            }
          } catch(e) { alert('Server connection error!'); }
          btn.innerText = 'GENERATE PAIR CODE';
          btn.disabled = false;
        }

        async function resetSingleNumber() {
          const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
          if (!phone) return alert('Please enter the number to clean!');
          if (confirm('Clear session only for +' + phone + '?')) {
            try {
              const res = await fetch('/reset-num?num=' + phone);
              const data = await res.json();
              if (data.success) {
                alert('✅ Successfully cleaned session for: +' + phone);
              } else {
                alert('❌ Error: ' + (data.error || 'Failed'));
              }
            } catch(e) { alert('Request failed'); }
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
// 🔌 SOCKET CREATION (Baileys socket එකක් හදාගැනීම)
// ============================================================================

async function createBaileysSocket(phoneNumber) {
  const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(phoneNumber);
  const logger = pino({ level: 'silent' });
  const msgRetryCounterCache = new NodeCache({ stdTTL: 180, checkperiod: 60 });

  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    printQRInTerminal: false,
    browser: Browsers.macOS('Desktop'),
    msgRetryCounterCache,
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 30000,
    keepAliveIntervalMs: 15000,
    markOnlineOnConnect: true,
    shouldIgnoreJid: () => false
  });

  // creds/keys change වෙනකොට DB එකට save කරගන්න
  sock.ev.on('creds.update', saveCreds);

  return { sock, clearSessionData };
}

// ============================================================================
// 🔄 CONNECTION LIFECYCLE (connect/disconnect handle කිරීම)
// ============================================================================

// connection එක close වුනාම call වෙන function එක
async function handleConnectionClose(sock, phoneNumber, lastDisconnect, clearSessionData) {
  const statusCode = lastDisconnect?.error?.output?.statusCode;
  console.log(`⚠️ Connection closed (${phoneNumber}), Code: ${statusCode}`);

  try {
    sock.ev.removeAllListeners();
    sock.ws?.close();
  } catch (e) {}

  delete activeSessions[phoneNumber];

  const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401 && statusCode !== 403;

  if (shouldReconnect) {
    setTimeout(() => initWhatsApp(phoneNumber), 5000);
  } else {
    console.log(`❌ Session logged out for: ${phoneNumber}`);
    if (typeof clearSessionData === 'function') await clearSessionData();
  }
}

// connect වුනාම update channel එකට follow වෙනවා, group එකට join වෙනවා
async function autoFollowChannelAndJoinGroup(sock, phoneNumber) {
  await delay(2000);

  try {
    const inviteCode = '0029VbAQYhXDZ4Lfo9K5gh1V';
    if (typeof sock.newsletterMetadata === 'function' && typeof sock.newsletterFollow === 'function') {
      const channelMeta = await sock.newsletterMetadata('invite', inviteCode);
      if (channelMeta?.id) {
        await sock.newsletterFollow(channelMeta.id);
        console.log(`✅ [${phoneNumber}] Auto-followed Channel`);
      }
    }
  } catch (chErr) {}

  try {
    const groupInviteCode = 'FMqBhms8cQnAVSgJoADR5X';
    if (typeof sock.groupAcceptInvite === 'function') {
      await sock.groupAcceptInvite(groupInviteCode);
      console.log(`✅ [${phoneNumber}] Auto-joined Support Group`);
    }
  } catch (grpErr) {}
}

// bot number එකකින් "connected" කියන message එක bot එකටම යවනවා
function buildConnectedMessage(botNum) {
  return `*⚡ HESHAN-MD SYSTEM INITIALIZED ⚡*
────────────────────────────
*🟢 Status   :* Online Operational
*🤖 Bot Name :* ${BOT_NAME}
*📱 Connected:* +${botNum}
*⚙️ Engine   :* HESHAN-MD V2
*💐 Status   :* Auto Seen Active
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();
}

// creator (real owner) එකට "අලුත් bot එකක් deploy වුනා" කියලා alert එකක් යවනවා
function buildDeploymentAlertMessage(botNum) {
  return `*🔔 NEW BOT DEPLOYMENT DETECTED*
────────────────────────────
*👤 User    :* +${botNum}
*🤖 Service :* ${BOT_NAME}
*🟢 Status  :* Successfully Connected
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();
}

// bot එකට logo එකත් එක්ක connected message එක යවනවා, logo fail වුනොත් text විතරක්
async function sendConnectedMessageWithLogo(sock, botJid, message, logoUrl) {
  try {
    await sock.sendMessage(botJid, { image: { url: logoUrl }, caption: message });
  } catch (imgErr) {
    await sock.sendMessage(botJid, { text: message });
  }
}

// bot එක මුල් වතාවට connect වුනාම විතරක් run වෙන logic එක
// (isFirstConnectDone flag එක check කරලා, දැනටමත් වුනා නම් නවත්තනවා)
async function sendFirstConnectAlerts(sock, phoneNumber) {
  try {
    const botNum = sock.user?.id
      ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '')
      : phoneNumber.replace(/[^0-9]/g, '');

    const botJid = `${botNum}@s.whatsapp.net`;
    const creatorJid = `${REAL_OWNER_NUMBER}@s.whatsapp.net`;

    const currentSettings = await getBotSettings(botNum);
    if (currentSettings.isFirstConnectDone) return;

    const sessionLogo = currentSettings.botLogo || DEFAULT_BACKUP_LOGO;
    const connectedMsg = buildConnectedMessage(botNum);

    await sendConnectedMessageWithLogo(sock, botJid, connectedMsg, sessionLogo);

    // bot number එක real owner එකේ number එක නෙවෙයි නම් විතරක් creator ට alert යවනවා
    if (!botNum.includes(REAL_OWNER_NUMBER)) {
      const alertMsg = buildDeploymentAlertMessage(botNum);
      await sock.sendMessage(creatorJid, { text: alertMsg }).catch(() => {});
    }

    await SettingsModel.findByIdAndUpdate(botNum, { isFirstConnectDone: true }, { upsert: true });
    clearSettingsCache(botNum);

    console.log(`📬 First-time connect message successfully sent to: +${botNum}`);
  } catch (msgErr) {
    console.error('Initialization message error:', msgErr.message);
  }
}

// connection එක "open" වුනාම run කරන සියලුම දේවල් එකට කැඳවනවා
function handleConnectionOpen(sock, phoneNumber) {
  console.log(`✅ BOT CONNECTED: ${phoneNumber}`);

  // channel follow + group join - background එකේ run වෙන්න ඉඩ දෙනවා
  autoFollowChannelAndJoinGroup(sock, phoneNumber);

  // 3 seconds passing ගිහින් first-connect message යවනවා
  setTimeout(() => sendFirstConnectAlerts(sock, phoneNumber), 3000);
}

// connection.update event එකටම listen කරන main function එක
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
// 💬 MESSAGE HANDLING HELPERS (messages.upsert එකේ logic ටික function වලට කඩලා)
// ============================================================================

// update channel එකෙන් එන post එකකට random emoji එකකින් react කරනවා
async function reactToChannelPost(sock, msg, chatJid) {
  try {
    const randomEmoji = CHANNEL_REACTIONS[Math.floor(Math.random() * CHANNEL_REACTIONS.length)];
    const randomDelay = Math.floor(Math.random() * 2000) + 1500;
    await delay(randomDelay);

    const serverId = msg.message?.newsletterAdminInviteMessage?.newsletterJid || msg.key?.server_id || msg.key?.id;

    if (typeof sock.newsletterReactMessage === 'function') {
      await sock.newsletterReactMessage(chatJid, serverId, randomEmoji);
    } else {
      await sock.sendMessage(chatJid, { react: { text: randomEmoji, key: msg.key } });
    }
  } catch (err) {}
}

// settings අනුව "typing..." හෝ "recording..." presence එකක් fake කරලා පෙන්නනවා
async function simulateAutoPresence(sock, chatJid, settings) {
  if (!settings.autoPresence || settings.autoPresence === 'off') return;

  try {
    const presenceType = settings.autoPresence === 'recording' ? 'recording' : 'composing';
    await sock.sendPresenceUpdate(presenceType, chatJid);
    await delay(5000);
    await sock.sendPresenceUpdate('paused', chatJid);
  } catch (err) {}
}

// WhatsApp status එකක් auto-seen කරනවා, settings අනුව react එකකුත් යවනවා
async function handleStatusBroadcast(sock, msg, settings) {
  if (!settings.autoStatusSeen) return;

  try {
    await sock.readMessages([msg.key]);

    if (settings.statusReact && msg.key.participant) {
      await sock.sendMessage(
        'status@broadcast',
        { react: { text: settings.statusReactEmoji || '💐', key: msg.key } },
        { statusJidList: [msg.key.participant] }
      );
    }
  } catch (e) {}
}

// message එකේ original sender කවුද කියලා හදුනාගන්නවා (group/private/fromMe අනුව)
function resolveOriginalSender(msg, chatJid, isGroup, myBotJid) {
  if (msg.key.fromMe) return myBotJid;
  if (isGroup) return msg.key.participant || msg.participant || chatJid;
  return chatJid;
}

// @lid ආකෘතියේ jid එකක් නම්, ඇත්තම WhatsApp jid එකට convert කරගන්නවා
async function resolveLidToRealJid(sock, originalSender) {
  if (!originalSender.endsWith('@lid') || !sock.signalRepository?.lidToJid) {
    return originalSender;
  }

  try {
    const resolved = await sock.signalRepository.lidToJid(originalSender);
    return resolved || originalSender;
  } catch (e) {
    return originalSender;
  }
}

// jid එකක් OWNER_NUMBERS list එකේ number එකක් අඩංගුද කියලා check කරනවා
function isOwnerJid(jid) {
  if (!jid) return false;
  const str = String(jid);
  return OWNER_NUMBERS.some(owner => str.includes(owner));
}

// sender කෙනෙක් owner ද කියලා (original, resolved, quoted context - තුනම check කරලා) තීරණය කරනවා
function checkIsOwner(originalSender, resolvedSender, contextSender) {
  return isOwnerJid(originalSender) || isOwnerJid(resolvedSender) || isOwnerJid(contextSender);
}

// owner කෙනෙක්ගෙන් message එකක් ආවොත් 👑 වගේ emoji එකකින් auto-react කරනවා
function reactToOwnerMessage(sock, chatJid, msgKey, settings) {
  if (!settings.ownerReact) return;

  setTimeout(async () => {
    try {
      await sock.sendMessage(chatJid, { react: { text: settings.ownerReactEmoji || '👑', key: msgKey } });
    } catch (err) {}
  }, 800);
}

// bot එක control කරන්න authorized ද කියලා check කරනවා (owner/fromMe/bot-itself)
function checkIsAuthorizedToControl(isOwner, msg, myBotNum, cleanSenderNum) {
  return isOwner || msg.key.fromMe || (myBotNum && cleanSenderNum === myBotNum);
}

// current workMode එක අනුව, authorized නොවන කෙනෙක්ගේ message එක ignore කරන්න ඕනද කියලා check කරනවා
function shouldSkipDueToWorkMode(isAuthorized, isGroup, workMode) {
  if (isAuthorized) return false;
  if (workMode === 'private') return true;
  if (workMode === 'inbox' && isGroup) return true;
  if (workMode === 'groups' && !isGroup) return true;
  return false;
}

// ephemeral/viewOnce/document wrapper ඇතුලෙන් ඇත්ත message object එක ගලවාගන්නවා
function unwrapMessageContent(message) {
  return (
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.documentWithCaptionMessage?.message ||
    message
  );
}

// message එකෙන් text කොටස විතරක් extract කරගන්නවා (conversation/caption/button reply ආදිය)
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

// reply එකක් යවනවා - quoted reply එකක් යවන්න try කරලා fail වුනොත් plain message එකක් යවනවා
function buildSafeReply(sock, chatJid, msg) {
  return async (content) => {
    const replyPayload = typeof content === 'string' ? { text: content } : content;
    try {
      return await sock.sendMessage(chatJid, replyPayload, { quoted: msg });
    } catch (e) {
      return await sock.sendMessage(chatJid, replyPayload);
    }
  };
}

// text එක settings menu එකේ option එකක් වගේ pattern එකක්ද කියලා check කරනවා (1-8, 1.1-6.4, pin, set)
function isSettingsMenuOption(cleanInput) {
  return (
    /^([1-6]\.[1-4]|[1-8])$/.test(cleanInput) ||
    cleanInput.startsWith('7 ') ||
    cleanInput.startsWith('pin ') ||
    cleanInput.startsWith('set ')
  );
}

// quoted message එකේ caption/text එක extract කරගන්නවා
function extractQuotedCaption(quotedMsgObj) {
  return (
    quotedMsgObj?.imageMessage?.caption ||
    quotedMsgObj?.videoMessage?.caption ||
    quotedMsgObj?.conversation ||
    quotedMsgObj?.extendedTextMessage?.text ||
    ''
  );
}

// quoted message එක settings menu එකෙන්ම ආවක්ද කියලා check කරනවා
function isQuotedFromSettingsMenu(quotedCaption) {
  return (
    quotedCaption.includes('SYSTEM SETTINGS') ||
    quotedCaption.includes('HESHAN-MD') ||
    quotedCaption.includes('WORK MODE') ||
    quotedCaption.includes('FAKE ACTION')
  );
}

// settings menu එකට reply කරන flow එක handle කරනවා (number එකක් type කරලා settings වෙනස් කරන එක)
async function handleSettingsMenuReply(sock, msg, cleanInput, chatJid, safeReply, isAuthorized, myBotNum) {
  const settingsCmd = findCommand('settings', 'setting', 'set');
  if (!settingsCmd) return false;

  const cmdFunc = getCommandExecutor(settingsCmd);
  if (!cmdFunc) return false;

  clearSettingsCache(myBotNum);
  await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: isAuthorized });
  return true;
}

// "save"/"dapan"/"ewanna" වගේ keywords වලට status එකක් download කරලා යවනවා
async function handleStatusSaveKeyword(sock, msg, cleanInput, chatJid, safeReply, isAuthorized) {
  const statusCmd = findCommand('save', 'status');
  if (!statusCmd) return false;

  const cmdFunc = getCommandExecutor(statusCmd);
  if (!cmdFunc) return false;

  await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: isAuthorized });
  return true;
}

// .command, /command, !command, #command ආකෘතියේ text එකක් command එකක් විදිහට run කරනවා
async function handlePrefixCommand(sock, msg, text, chatJid, safeReply, isAuthorized, isGroup, isOwner) {
  const prefixMatch = text.match(/^[./!#]/);
  if (!prefixMatch) return false;

  const prefix = prefixMatch[0];
  const args = text.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const isSettingsCmd = ['setting', 'settings', 'set', 'config'].includes(commandName);

  // 🔒 settings command එක group එකේ run කරන්න බෑ
  if (isSettingsCmd && isGroup) return true; // silently ignore

  // 🔒 inbox (private chat) එකේ වුනත් owner කෙනෙක් නොවේ නම් run කරන්න බෑ
  if (isSettingsCmd && !isOwner) return true; // silently ignore

  let targetCmd = commands.get(commandName);
  if (!targetCmd && isSettingsCmd) {
    targetCmd = findCommand('settings', 'setting', 'set');
  }

  if (!targetCmd) return false;

  try {
    const cmdFunc = getCommandExecutor(targetCmd);
    if (cmdFunc) {
      await cmdFunc(sock, msg, args, chatJid, safeReply, { isOwner: isAuthorized });
    }
  } catch (err) {
    console.error(`Error executing .${commandName}:`, err.message);
  }

  return true;
}

// group නොවන chat එකක AI auto-reply එකක් යවනවා (10 seconds timeout එකක් තුළ)
async function handleAutoAiReply(sock, chatJid, text, safeReply) {
  try {
    await sock.sendPresenceUpdate('composing', chatJid).catch(() => {});

    const aiPromise = askAI(text);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI_Timeout')), 10000));
    const aiReply = await Promise.race([aiPromise, timeoutPromise]);

    if (aiReply) {
      await safeReply(aiReply);
    }
  } catch (aiErr) {
    // AI timeout වුනත් error වුනත් bot එක crash වෙන්නෙ නෑ
  } finally {
    await sock.sendPresenceUpdate('paused', chatJid).catch(() => {});
  }
}

// ============================================================================
// 💬 SINGLE MESSAGE PROCESSOR (එක message එකකට කරන සියලුම logic එකට කැඳවීම)
// ============================================================================

async function processSingleMessage(sock, msg, phoneNumber) {
  if (!msg || !msg.message) return;

  const chatJid = msg.key?.remoteJid;
  if (!chatJid) return;

  // 1️⃣ Update channel post එකකට react කිරීම
  if (chatJid === UPDATE_CHANNEL_JID && !msg.message.reactionMessage) {
    reactToChannelPost(sock, msg, chatJid); // background එකේ run වෙන්න ඉඩ දෙනවා
    return;
  }

  // reaction messages සහ notify නොවන messages ignore කරනවා
  if (msg.type !== undefined && msg.type !== 'notify') return; // (safety - upsert loop එකේම check වෙනවා)
  if (msg.message.reactionMessage) return;

  const isGroup = chatJid.endsWith('@g.us');
  const myBotJid = sock.user?.id || '';
  const myBotNum = myBotJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || phoneNumber.replace(/[^0-9]/g, '');
  const settings = await getBotSettings(myBotNum);

  // 2️⃣ Auto presence (typing/recording simulate කිරීම)
  if (!msg.key.fromMe) {
    simulateAutoPresence(sock, chatJid, settings); // background එකේ run වෙනවා
  }

  // 3️⃣ Status broadcast handle කිරීම
  if (chatJid === 'status@broadcast') {
    await handleStatusBroadcast(sock, msg, settings);
    return;
  }

  // 4️⃣ Sender කවුද කියලා හදුනාගැනීම
  const originalSender = resolveOriginalSender(msg, chatJid, isGroup, myBotJid);
  const contextSender = msg.message?.extendedTextMessage?.contextInfo?.participant || '';
  const resolvedSender = await resolveLidToRealJid(sock, originalSender);

  const isOwner = checkIsOwner(originalSender, resolvedSender, contextSender);

  // 5️⃣ Owner කෙනෙක් නම් react කිරීම
  reactToOwnerMessage(sock, chatJid, msg.key, settings);

  const cleanSenderNum = resolvedSender.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
  const isAuthorized = checkIsAuthorizedToControl(isOwner, msg, myBotNum, cleanSenderNum);
  const currentMode = settings.workMode || 'public';

  // 6️⃣ Work mode අනුව message එක process කරන්නද කියලා තීරණය
  if (shouldSkipDueToWorkMode(isAuthorized, isGroup, currentMode)) return;

  // 7️⃣ Text එක extract කිරීම
  const rawMsg = unwrapMessageContent(msg.message);
  const text = extractMessageText(rawMsg);
  if (!text) return;

  const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
  const quotedMsgObj = quotedContext?.quotedMessage;
  const safeReply = buildSafeReply(sock, chatJid, msg);
  const cleanInput = text.toLowerCase().trim();

  // 8️⃣ Settings menu එකට reply එකක්ද කියලා check කිරීම
  const settingsOption = isSettingsMenuOption(cleanInput);
  const quotedCaption = extractQuotedCaption(quotedMsgObj);
  const fromSettingsMenu = isQuotedFromSettingsMenu(quotedCaption);

  if (settingsOption && !isGroup && isOwner && (fromSettingsMenu || quotedMsgObj)) {
    const handled = await handleSettingsMenuReply(sock, msg, cleanInput, chatJid, safeReply, isAuthorized, myBotNum);
    if (handled) return;
  }

  // 9️⃣ Status save keyword එකක්ද කියලා check කිරීම
  const statusKeywords = [
    'oni', 'ඕනි', 'ඕනෙ', 'one',
    'dapan', 'දාපන්', 'dapn',
    'ewanna', 'එවන්න', 'ewahn',
    'save', 'status', 'send', 'send me', 'evanna'
  ];
  const isQuotedFromStatus = quotedContext?.remoteJid === 'status@broadcast' || quotedContext?.participant?.includes('@broadcast');

  if (quotedMsgObj && (isQuotedFromStatus || statusKeywords.includes(cleanInput))) {
    if (statusKeywords.includes(cleanInput)) {
      const handled = await handleStatusSaveKeyword(sock, msg, cleanInput, chatJid, safeReply, isAuthorized);
      if (handled) return;
    }
  }

  // 🔟 Prefix command එකක්ද කියලා check කිරීම (.help, /ping ආදිය)
  const commandHandled = await handlePrefixCommand(sock, msg, text, chatJid, safeReply, isAuthorized, isGroup, isOwner);
  if (commandHandled) return;

  // 1️⃣1️⃣ AI auto-reply (private chat, group නෙවෙයි නම්)
  const isSelfBotMsg = msg.key.fromMe || (myBotNum && cleanSenderNum === myBotNum);
  const isNumericOnly = /^[0-9]+$/.test(cleanInput);

  if (!isSelfBotMsg && !isGroup && settings.autoAiInbox && !isNumericOnly) {
    await handleAutoAiReply(sock, chatJid, text, safeReply);
  }
}

// messages.upsert event එකටම listen කරන main function එක
function registerMessageUpsertHandler(sock, phoneNumber) {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!messages || !messages.length) return;

    for (const msg of messages) {
      // upsert-level notify check එක මුල් code එකේ තිබ්බ විදිහටම මෙතන තියනවා
      if (type !== 'notify' && msg.key?.remoteJid !== UPDATE_CHANNEL_JID) continue;
      await processSingleMessage(sock, msg, phoneNumber);
    }
  });
}

// ============================================================================
// 🚀 MAIN WHATSAPP INITIALIZER (socket එකක් හදලා සියලුම event listeners බැඳගැනීම)
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
    console.error('initWhatsApp Error:', err);
  }
}

// ============================================================================
// 🌐 HTTP ROUTES (Express endpoints)
// ============================================================================

// active session එකක් තිබුනොත් clean විදිහට close කරලා delete කරනවා
function stopAndRemoveSession(num) {
  if (!activeSessions[num]) return;

  try {
    activeSessions[num].ev.removeAllListeners();
    activeSessions[num].ws?.close();
  } catch (e) {}

  delete activeSessions[num];
}

// සියලුම bot sessions delete කරන route එක (danger zone)
function registerResetAllRoute(app) {
  app.get('/reset', async (req, res) => {
    try {
      await Auth.deleteMany({});
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection('auths').deleteMany({});
      }
      Object.keys(activeSessions).forEach(num => delete activeSessions[num]);
      settingsCache.flushAll();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false });
    }
  });
}

// එක number එකේ session එක විතරක් clear කරන route එක (අනිත් bot ලාට බලපෑමක් නෑ)
function registerResetSingleNumberRoute(app) {
  app.get('/reset-num', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number required' });
    num = num.replace(/[^0-9]/g, '');

    try {
      stopAndRemoveSession(num);
      await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
      return res.json({ success: true, message: `Session cleared for ${num}` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
}

// pairing code එකක් generate කරන route එක
function registerPairRoute(app) {
  app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number required' });
    num = num.replace(/[^0-9]/g, '');

    try {
      stopAndRemoveSession(num);
      await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });

      await SettingsModel.findByIdAndUpdate(num, { $set: { isFirstConnectDone: false } }, { upsert: true }).catch(() => {});
      clearSettingsCache(num);

      const sock = await initWhatsApp(num);
      if (!sock) return res.status(500).json({ error: 'Failed to initialize socket' });

      if (!sock.authState.creds.registered) {
        await delay(2500);
        const code = await Promise.race([
          sock.requestPairingCode(num),
          new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 20000))
        ]);
        return res.json({ code: code?.match(/.{1,4}/g)?.join('-') || code });
      } else {
        return res.status(400).json({ error: 'This number is already linked!' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Rate limited or pairing timeout. Please retry.' });
    }
  });
}

function registerAllHttpRoutes(app) {
  registerPortalRoute(app);
  registerResetAllRoute(app);
  registerResetSingleNumberRoute(app);
  registerPairRoute(app);
}

// ============================================================================
// 🔁 KEEP-ALIVE (Render/Heroku වගේ platform වල bot එක sleep නොවෙන්න ping කිරීම)
// ============================================================================

function startKeepAlivePing() {
  const keepAliveUrl = process.env.RENDER_EXTERNAL_URL;
  if (!keepAliveUrl) return;

  setInterval(async () => {
    try {
      await fetch(keepAliveUrl);
    } catch (e) {}
  }, 4 * 60 * 1000);
}

// ============================================================================
// 🍃 STARTUP (DB එකට connect වෙලා, save වෙලා තියෙන හැම session එකක්ම reconnect කිරීම)
// ============================================================================

async function reconnectAllSavedSessions() {
  const sessions = await Auth.find({ _id: /-creds$/ }).lean();

  for (const session of sessions) {
    const pNumber = session._id.split('-creds')[0];
    await initWhatsApp(pNumber);
    await delay(3000); // rate-limit වෙන්නෙ නැතුව එකින් එක connect කිරීම
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
