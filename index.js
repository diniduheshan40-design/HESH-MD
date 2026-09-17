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

// 🟢 Config & DB Models
const { MONGODB_URI, BOT_NAME } = require('./config');
const { useMongoDBAuthState, Auth } = require('./auth');
const { askAI } = require('./ai');

// 🟢 Target Update Channel for Auto-React
const UPDATE_CHANNEL_JID = '120363421906774107@newsletter';
const CHANNEL_REACTIONS = ['🥰', '👍', '❤️', '😗', '😯', '🪄', '✨'];

// 🟢 Local Logo Verification & Auto-Download Engine (Fixes Logo Issues)
const LOCAL_LOGO_PATH = path.join(process.cwd(), 'logo.jpg');
const DEFAULT_BACKUP_LOGO = 'https://files.catbox.moe/a58add.jpeg';

async function ensureLocalLogo() {
  try {
    if (!fs.existsSync(LOCAL_LOGO_PATH)) {
      console.log('🖼️ Local logo not found, downloading default asset...');
      const res = await fetch(DEFAULT_BACKUP_LOGO);
      if (res.ok) {
        const buffer = await res.buffer();
        fs.writeFileSync(LOCAL_LOGO_PATH, buffer);
        console.log('✅ Default logo.jpg saved successfully.');
      }
    }
  } catch (err) {
    console.error('⚠️ Logo download check skipped:', err.message);
  }
}
ensureLocalLogo();

// 🟢 RAM Cache for Settings
const settingsCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const SettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  workMode: { type: String, default: 'public' },
  autoAiInbox: { type: Boolean, default: true },
  autoStatusSeen: { type: Boolean, default: true },
  statusReact: { type: Boolean, default: true },
  statusReactEmoji: { type: String, default: '💐' },
  ownerReact: { type: Boolean, default: true },
  ownerReactEmoji: { type: String, default: '👑' },
  securityPin: { type: String, default: '1234' },
  isFirstConnectDone: { type: Boolean, default: false }
});

const SettingsModel = mongoose.models.BotSettings || mongoose.model('BotSettings', SettingsSchema);

async function getBotSettings(botNum) {
  const cached = settingsCache.get(botNum);
  if (cached) return cached;

  try {
    let s = await SettingsModel.findById(botNum).lean();
    if (!s) {
      const created = await SettingsModel.create({ _id: botNum });
      s = created.toObject();
    }
    settingsCache.set(botNum, s);
    return s;
  } catch (e) {
    return {
      workMode: 'public',
      autoAiInbox: true,
      autoStatusSeen: true,
      statusReact: true,
      statusReactEmoji: '💐',
      ownerReact: true,
      ownerReactEmoji: '👑',
      securityPin: '1234',
      isFirstConnectDone: false
    };
  }
}

// 🟢 Global State & Masters
const REAL_OWNER_NUMBER = '94719845166';
global.OWNER_NUMBERS = ['94719845166', '94720882316', '15947733680169'];
global.activeSessions = {};
const isStarting = {};

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// 🟢 1. Command Loader
const commands = new Map();
const cmdDir = path.join(__dirname, 'commands');

if (fs.existsSync(cmdDir)) {
  const cmdFiles = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));
  for (const file of cmdFiles) {
    try {
      let cmd = require(`./commands/${file}`);
      if (cmd.default) cmd = cmd.default;
      const cmdName = file.replace('.js', '').toLowerCase();

      if (cmd && cmd.name) commands.set(cmd.name.toLowerCase(), cmd);
      commands.set(cmdName, cmd);

      if (cmd && cmd.alias) {
        if (Array.isArray(cmd.alias)) {
          for (const al of cmd.alias) commands.set(al.toLowerCase(), cmd);
        } else if (typeof cmd.alias === 'string') {
          commands.set(cmd.alias.toLowerCase(), cmd);
        }
      }
      console.log(`✅ Loaded command: .${cmdName}`);
    } catch (e) {
      console.error(`❌ Error loading ${file}:`, e.message);
    }
  }
}

// 🟢 2. Red & Black Cyber Portal UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${BOT_NAME} • PORTAL</title>
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
        .btn-reset { background: rgba(225, 29, 72, 0.1); border: 1px solid rgba(225, 29, 72, 0.3); color: #fb7185; }
        .code-display { 
          font-family: 'JetBrains Mono', monospace; font-size: 30px; font-weight: 800; 
          color: #ff2a55; letter-spacing: 5px; margin-top: 25px; display: none; 
          background: rgba(225, 29, 72, 0.08); padding: 15px; border-radius: 12px; border: 1px dashed rgba(225, 29, 72, 0.4);
        }
      </style>
    </head>
    <body>
      <div class="glass-panel">
        <h1 class="title">${BOT_NAME}</h1>
        <p class="subtitle">Enter WhatsApp number with country code</p>
        <input type="text" id="phone" placeholder="9470xxxxxxx" />
        <button id="btn" onclick="getCode()">GENERATE PAIR CODE</button>
        <button class="btn-reset" onclick="resetDB()">RESET DATABASE</button>
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
        async function resetDB() {
          if(confirm('Clear all database sessions?')) {
            await fetch('/reset');
            location.reload();
          }
        }
      </script>
    </body>
    </html>
  `);
});

// 🟢 3. WhatsApp Socket Engine
async function initWhatsApp(phoneNumber) {
  if (global.activeSessions[phoneNumber]) return global.activeSessions[phoneNumber];
  if (isStarting[phoneNumber]) return;
  isStarting[phoneNumber] = true;

  try {
    const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(phoneNumber);
    const logger = pino({ level: 'silent' });
    const msgRetryCounterCache = new NodeCache({ stdTTL: 180, checkperiod: 60 });

    let version = [2, 3000, 1015901307];
    try {
      const vData = await fetchLatestBaileysVersion();
      if (vData?.version) version = vData.version;
    } catch (e) {}

    const sock = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      logger, 
      printQRInTerminal: false, 
      browser: Browsers.ubuntu('Chrome'), 
      msgRetryCounterCache,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 45000,
      defaultQueryTimeoutMs: 30000,
      keepAliveIntervalMs: 15000,
      markOnlineOnConnect: false,
      shouldIgnoreJid: () => false
    });

    global.activeSessions[phoneNumber] = sock;
    delete isStarting[phoneNumber];

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(`⚠️ Connection closed (${phoneNumber}), Code: ${statusCode}`);

        try {
          sock.ev.removeAllListeners();
          sock.ws?.close();
        } catch (e) {}
        delete global.activeSessions[phoneNumber];

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401 && statusCode !== 403;
        if (shouldReconnect) {
          setTimeout(() => initWhatsApp(phoneNumber), 5000);
        } else {
          console.log(`❌ Session logged out for: ${phoneNumber}`);
          if (typeof clearSessionData === 'function') await clearSessionData();
        }
      } else if (connection === 'open') {
        console.log(`✅ BOT CONNECTED: ${phoneNumber}`);
        
        // Auto Follow & Group Join
        (async () => {
          try {
            await delay(2000);
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
        })();

        // First Connect Alert
        setTimeout(async () => {
          try {
            const botNum = sock.user?.id ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : phoneNumber.replace(/[^0-9]/g, '');
            const botJid = `${botNum}@s.whatsapp.net`;
            const creatorJid = `${REAL_OWNER_NUMBER}@s.whatsapp.net`;

            const currentSettings = await getBotSettings(botNum);
            if (currentSettings.isFirstConnectDone) {
              console.log(`ℹ️ [RESTART / DEPLOY] +${botNum} reconnect detected. Connecting message skipped.`);
              return;
            }

            const welcomeImg = 'https://files.catbox.moe/a58add.jpeg';
            const connectedMsg = `*⚡ HESHAN-MD SYSTEM INITIALIZED ⚡*
────────────────────────────
*🟢 Status   :* Online Operational
*🤖 Bot Name :* ${BOT_NAME}
*📱 Connected:* +${botNum}
*⚙️ Engine   :* HESHAN-MD V2
*💐 Status   :* Auto Seen Active
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

            try {
              let logoPayload = fs.existsSync(LOCAL_LOGO_PATH) 
                ? fs.readFileSync(LOCAL_LOGO_PATH) 
                : { url: welcomeImg };

              await sock.sendMessage(botJid, { 
                image: logoPayload,
                caption: connectedMsg
              });
            } catch (imgErr) {
              await sock.sendMessage(botJid, { text: connectedMsg });
            }

            if (!botNum.includes(REAL_OWNER_NUMBER)) {
              const alertMsg = `*🔔 NEW BOT DEPLOYMENT DETECTED*
────────────────────────────
*👤 User    :* +${botNum}
*🤖 Service :* ${BOT_NAME}
*🟢 Status  :* Successfully Connected
────────────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();
              await sock.sendMessage(creatorJid, { text: alertMsg }).catch(() => {});
            }

            await SettingsModel.findByIdAndUpdate(botNum, { isFirstConnectDone: true }, { upsert: true });
            settingsCache.del(botNum);

            console.log(`📬 First-time connect message successfully sent to: +${botNum}`);
          } catch (msgErr) {
            console.error('Initialization message error:', msgErr.message);
          }
        }, 3000);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (!messages || !messages.length) return;

      for (const msg of messages) {
        if (!msg || !msg.message) continue;

        const chatJid = msg.key?.remoteJid;
        if (!chatJid) continue;

        // Auto React to Update Channel
        if (chatJid === UPDATE_CHANNEL_JID && !msg.message.reactionMessage) {
          (async () => {
            try {
              const randomEmoji = CHANNEL_REACTIONS[Math.floor(Math.random() * CHANNEL_REACTIONS.length)];
              const randomDelay = Math.floor(Math.random() * 2000) + 1500;
              await delay(randomDelay);

              const serverId = msg.message?.newsletterAdminInviteMessage?.newsletterJid || msg.key?.server_id || msg.key?.id;

              if (typeof sock.newsletterReactMessage === 'function') {
                await sock.newsletterReactMessage(chatJid, serverId, randomEmoji);
              } else {
                await sock.sendMessage(chatJid, {
                  react: { text: randomEmoji, key: msg.key }
                });
              }
            } catch (err) {}
          })();
          continue;
        }

        if (type !== 'notify' || msg.message.reactionMessage) continue;

        const isGroup = chatJid.endsWith('@g.us');
        const myBotJid = sock.user?.id || '';
        const myBotNum = myBotJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '') || phoneNumber.replace(/[^0-9]/g, '');
        const currentBotSettings = await getBotSettings(myBotNum);

        // Auto Status Seen
        if (chatJid === 'status@broadcast') {
          if (currentBotSettings.autoStatusSeen) {
            try {
              await sock.readMessages([msg.key]);
              if (currentBotSettings.statusReact && msg.key.participant) {
                await sock.sendMessage(
                  'status@broadcast',
                  { react: { text: currentBotSettings.statusReactEmoji || '💐', key: msg.key } },
                  { statusJidList: [msg.key.participant] }
                );
              }
            } catch (e) {}
          }
          continue;
        }

        // Sender Resolution
        let senderJid = msg.key.fromMe 
          ? myBotJid 
          : (isGroup ? (msg.key.participant || msg.participant || '') : chatJid);

        const contextSender = msg.message?.extendedTextMessage?.contextInfo?.participant || '';

        if (senderJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
          try {
            const resolved = await sock.signalRepository.lidToJid(senderJid);
            if (resolved) senderJid = resolved;
          } catch (e) {}
        }

        const cleanSenderNum = senderJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
        const cleanContextNum = contextSender.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

        const isMasterCreator = cleanSenderNum.includes(REAL_OWNER_NUMBER) || cleanContextNum.includes(REAL_OWNER_NUMBER);
        const isOwner = global.OWNER_NUMBERS.some(owner => cleanSenderNum.includes(owner) || cleanContextNum.includes(owner));

        // Owner React
        const isSelfMessageOnSameBot = msg.key.fromMe && myBotNum.includes(REAL_OWNER_NUMBER);
        if (currentBotSettings.ownerReact && isMasterCreator && !isSelfMessageOnSameBot) {
          const reactTargetKey = {
            remoteJid: chatJid,
            fromMe: msg.key.fromMe,
            id: msg.key.id,
            participant: isGroup ? (msg.key.participant || msg.participant) : undefined
          };
          sock.sendMessage(chatJid, {
            react: { text: currentBotSettings.ownerReactEmoji || '👑', key: reactTargetKey }
          }).catch(() => {});
        }

        // Work Mode Check
        const isAuthorizedToControl = isOwner || msg.key.fromMe || (myBotNum && cleanSenderNum === myBotNum);
        const currentMode = currentBotSettings.workMode || 'public';

        if (!isAuthorizedToControl) {
          if (currentMode === 'private') continue;
          if (currentMode === 'inbox' && isGroup) continue;
          if (currentMode === 'groups' && !isGroup) continue;
        }

        // Text Unwrapping
        const rawMsg = msg.message.ephemeralMessage?.message || 
                       msg.message.viewOnceMessage?.message || 
                       msg.message.viewOnceMessageV2?.message || 
                       msg.message.documentWithCaptionMessage?.message ||
                       msg.message;

        const text = (
          rawMsg?.conversation ||
          rawMsg?.extendedTextMessage?.text ||
          rawMsg?.imageMessage?.caption ||
          rawMsg?.videoMessage?.caption ||
          rawMsg?.buttonsResponseMessage?.selectedButtonId ||
          rawMsg?.templateButtonReplyMessage?.selectedId ||
          ''
        ).trim();

        if (!text) continue;

        const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
        const quotedMsgObj = quotedContext?.quotedMessage;

        const safeReply = async (content) => {
          const replyPayload = typeof content === 'string' ? { text: content } : content;
          try { 
            return await sock.sendMessage(chatJid, replyPayload, { quoted: msg }); 
          } catch (e) { 
            return await sock.sendMessage(chatJid, replyPayload); 
          }
        };

        // 🟢 5. SETTINGS DIRECT REPLY INTERCEPTOR
        const cleanInput = text.toLowerCase().trim();
        const isSettingCode = /^(\d\.\d|\d)$/.test(cleanInput) || cleanInput.startsWith('6 ') || cleanInput.startsWith('pin ');
        const quotedText = quotedMsgObj?.conversation || quotedMsgObj?.extendedTextMessage?.text || '';
        const isQuotedFromSettings = quotedText.includes('SYSTEM SETTINGS') || quotedText.includes('WORK MODE') || quotedText.includes('AUTO AI INBOX');

        if (isSettingCode && quotedMsgObj && isQuotedFromSettings && isAuthorizedToControl) {
          const settingsCmd = commands.get('settings') || commands.get('setting') || commands.get('set');
          if (settingsCmd) {
            const cmdFunc = typeof settingsCmd === 'function' ? settingsCmd : (settingsCmd.execute || settingsCmd.run);
            if (typeof cmdFunc === 'function') {
              settingsCache.del(myBotNum);
              await cmdFunc(sock, msg, text.split(/ +/), chatJid, safeReply, { isOwner: isAuthorizedToControl });
              continue;
            }
          }
        }

        // 🟢 6. AUTO STATUS SAVE
        const statusKeywords = [
          'oni', 'ඕනි', 'ඕනෙ', 'one', 
          'dapan', 'දාපන්', 'dapn', 
          'ewanna', 'එවන්න', 'ewahn', 
          'save', 'status', 'send', 'send me', 'evanna'
        ];

        const isQuotedFromStatus = quotedContext?.remoteJid === 'status@broadcast' || quotedContext?.participant?.includes('@broadcast');

        if (quotedMsgObj && (isQuotedFromStatus || statusKeywords.includes(cleanInput))) {
          if (statusKeywords.includes(cleanInput)) {
            const statusCmd = commands.get('save') || commands.get('status');
            if (statusCmd) {
              const cmdFunc = typeof statusCmd === 'function' ? statusCmd : (statusCmd.downloadAndSendStatus || statusCmd.execute || statusCmd.run);
              if (typeof cmdFunc === 'function') {
                await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: isAuthorizedToControl });
                continue;
              }
            }
          }
        }

        // 🟢 7. COMMAND DISPATCHER (Supports Prefix . / ! #)
        const prefixMatch = text.match(/^[./!#]/);
        if (prefixMatch) {
          const prefix = prefixMatch[0];
          const args = text.slice(prefix.length).trim().split(/ +/);
          const commandName = args.shift().toLowerCase();

          let targetCmd = commands.get(commandName);
          if (!targetCmd && ['setting', 'settings', 'set', 'config'].includes(commandName)) {
            targetCmd = commands.get('settings') || commands.get('setting') || commands.get('set');
          }

          if (targetCmd) {
            try {
              const cmdFunc = typeof targetCmd === 'function' ? targetCmd : (targetCmd.execute || targetCmd.run);
              if (typeof cmdFunc === 'function') {
                // Compatible with both execute(sock, msg, args, chatJid, safeReply, extra) forms
                await cmdFunc(sock, msg, args, chatJid, safeReply, { isOwner: isAuthorizedToControl });
              }
            } catch (err) {
              console.error(`Error executing .${commandName}:`, err.message);
            }
            continue;
          }
        }

        // 🟢 8. INBOX AUTO-AI SYSTEM
        const isSelfBotMsg = msg.key.fromMe || (myBotNum && cleanSenderNum === myBotNum);
        const isNumericOnly = /^[0-9]+$/.test(cleanInput);

        if (!isSelfBotMsg && !isGroup && currentBotSettings.autoAiInbox && !isNumericOnly) {
          try {
            await sock.sendPresenceUpdate('composing', chatJid).catch(() => {});
            
            const aiPromise = askAI(text);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('AI_Timeout')), 10000));
            const aiReply = await Promise.race([aiPromise, timeoutPromise]);

            if (aiReply) {
              await safeReply(aiReply);
            }
          } catch (aiErr) {
          } finally {
            await sock.sendPresenceUpdate('paused', chatJid).catch(() => {});
          }
        }
      }
    });

    return sock;
  } catch (err) {
    delete isStarting[phoneNumber];
    console.error('initWhatsApp Error:', err);
  }
}

// 🟢 4. HTTP Routes & Keep-Alive Server
app.get('/reset', async (req, res) => {
  try {
    await Auth.deleteMany({});
    if (mongoose.connection.db) await mongoose.connection.db.collection('auths').deleteMany({});
    global.activeSessions = {};
    settingsCache.flushAll();
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ success: false }); 
  }
});

app.get('/pair', async (req, res) => {
  let num = req.query.num;
  if (!num) return res.status(400).json({ error: 'Number required' });
  num = num.replace(/[^0-9]/g, '');

  try {
    if (global.activeSessions[num]) { 
      try { 
        global.activeSessions[num].ev.removeAllListeners();
        global.activeSessions[num].ws?.close(); 
      } catch(e) {} 
      delete global.activeSessions[num]; 
    }
    await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
    
    await SettingsModel.findByIdAndUpdate(num, { isFirstConnectDone: false }).catch(() => {});
    settingsCache.del(num);

    const sock = await initWhatsApp(num);
    if (!sock) return res.status(500).json({ error: 'Failed to initialize socket' });

    if (!sock.authState.creds.registered) {
      await delay(2000);
      const code = await Promise.race([
        sock.requestPairingCode(num), 
        new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 15000))
      ]);
      return res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });
    } else {
      return res.status(400).json({ error: 'This number is already linked!' });
    }
  } catch (err) { 
    return res.status(500).json({ error: 'Rate limited or pairing timeout. Please retry.' }); 
  }
});

// 🟢 5. Database Connection & Server Initialization
mongoose.connect(MONGODB_URI).then(async () => {
  console.log('🍃 MongoDB Connected!');
  
  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);

    const keepAliveUrl = process.env.RENDER_EXTERNAL_URL;
    if (keepAliveUrl) {
      setInterval(async () => {
        try {
          await fetch(keepAliveUrl);
        } catch (e) {}
      }, 4 * 60 * 1000);
    }
  });

  const sessions = await Auth.find({ _id: /-creds$/ }).lean();
  for (const session of sessions) {
    const pNumber = session._id.split('-creds')[0];
    await initWhatsApp(pNumber);
    await delay(3000);
  }
}).catch(err => console.error('MongoDB Connection Error:', err));

