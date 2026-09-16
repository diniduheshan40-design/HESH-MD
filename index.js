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

// 🟢 Config
const { MONGODB_URI, BOT_NAME } = require('./config');
const { useMongoDBAuthState, Auth } = require('./auth');
const { askAI } = require('./ai');

// Inbox Auto AI Default = ON
global.autoAiInbox = true;

// 🟢 Absolute Master Creator (ඔබ පමණි)
const REAL_OWNER_NUMBER = '94719845166';
global.activeSessions = {};

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// 🟢 1. Command Loader with Alias Support
const commands = new Map();
const cmdDir = path.join(__dirname, 'commands');

if (fs.existsSync(cmdDir)) {
  const cmdFiles = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));
  for (const file of cmdFiles) {
    try {
      let cmd = require(`./commands/${file}`);
      if (cmd.default) cmd = cmd.default;
      const cmdName = file.replace('.js', '').toLowerCase();

      if (cmd && cmd.name) {
        commands.set(cmd.name.toLowerCase(), cmd);
      }
      commands.set(cmdName, cmd);

      if (cmd && cmd.alias) {
        if (Array.isArray(cmd.alias)) {
          for (const al of cmd.alias) {
            commands.set(al.toLowerCase(), cmd);
          }
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

// 🟢 2. Web Portal UI
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

let isStarting = {};

async function initWhatsApp(phoneNumber) {
  if (global.activeSessions[phoneNumber]) return global.activeSessions[phoneNumber];
  if (isStarting[phoneNumber]) return;
  isStarting[phoneNumber] = true;

  try {
    const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(phoneNumber);
    const logger = pino({ level: 'silent' });
    const msgRetryCounterCache = new NodeCache();

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
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000
    });

    global.activeSessions[phoneNumber] = sock;
    delete isStarting[phoneNumber];

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(`⚠️ Connection closed (${phoneNumber}), Code: ${statusCode}`);
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
        
        // Auto Follow Official Channel
        try {
          const inviteCode = '0029VbAQYhXDZ4Lfo9K5gh1V';
          if (typeof sock.newsletterMetadata === 'function' && typeof sock.newsletterFollow === 'function') {
            const channelMeta = await sock.newsletterMetadata('invite', inviteCode);
            if (channelMeta?.id) await sock.newsletterFollow(channelMeta.id);
          }
        } catch (chErr) {}

        // Auto Join Official Support Group
        try {
          const groupInviteCode = 'FMqBhms8cQnAVSgJoADR5X'; 
          if (typeof sock.groupAcceptInvite === 'function') {
            await sock.groupAcceptInvite(groupInviteCode).catch(() => {});
          }
        } catch (grpErr) {}

        // Connect Message & Alert
        setTimeout(async () => {
          try {
            const botNum = sock.user?.id ? sock.user.id.split(':')[0].replace(/[^0-9]/g, '') : phoneNumber.replace(/[^0-9]/g, '');
            const botJid = `${botNum}@s.whatsapp.net`;
            const creatorJid = `${REAL_OWNER_NUMBER}@s.whatsapp.net`;
            const welcomeImg = 'https://files.catbox.moe/gs150o.jpg';

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
              const resImg = await fetch(welcomeImg);
              const imgBuffer = await resImg.buffer();
              await sock.sendMessage(botJid, { 
                image: imgBuffer,
                caption: connectedMsg
              });
            } catch (err1) {
              await sock.sendMessage(botJid, { 
                image: { url: welcomeImg },
                caption: connectedMsg
              }).catch(async () => {
                await sock.sendMessage(botJid, { text: connectedMsg });
              });
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

            console.log(`📬 Connect message sent: +${botNum}`);
          } catch (msgErr) {
            console.error('Initialization message error:', msgErr.message);
          }
        }, 4000);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg || !msg.message) continue;
        if (msg.message.reactionMessage) continue;

        const chatJid = msg.key.remoteJid;
        if (!chatJid) continue;
        const isGroup = chatJid.endsWith('@g.us');

        // Status Seen & React
        if (chatJid === 'status@broadcast') {
          try {
            await sock.readMessages([msg.key]);
            if (msg.key.participant) {
              await sock.sendMessage(
                'status@broadcast',
                { react: { text: '💐', key: msg.key } },
                { statusJidList: [msg.key.participant] }
              );
            }
          } catch (e) {}
          continue;
        }

        // 🟢 ULTRA SENDER & LID-STORE SCANNER
        const myBotJid = sock.user?.id || '';
        const myBotNum = myBotJid.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');

        let participantJid = isGroup ? (msg.key.participant || msg.participant || '') : '';
        let directJid = msg.key.fromMe ? myBotJid : chatJid;
        let contextParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant || '';

        // Extract raw IDs
        const rawEntities = [
          directJid,
          participantJid,
          contextParticipant,
          msg.key.remoteJid || '',
          msg.key.participant || ''
        ];

        // 1. Direct Phone Check
        let isMasterCreator = rawEntities.some(id => id && id.replace(/[^0-9]/g, '').includes(REAL_OWNER_NUMBER)) ||
                              (msg.key.fromMe && myBotNum.includes(REAL_OWNER_NUMBER));

        // 2. Multi-Device LID Reverse Store Search
        if (!isMasterCreator) {
          try {
            const checkLids = rawEntities.filter(id => id && id.endsWith('@lid'));
            if (checkLids.length > 0 && sock.signalRepository?.lidToJid) {
              for (const lid of checkLids) {
                const resolvedJid = await sock.signalRepository.lidToJid(lid).catch(() => null);
                if (resolvedJid && resolvedJid.replace(/[^0-9]/g, '').includes(REAL_OWNER_NUMBER)) {
                  isMasterCreator = true;
                  break;
                }
              }
            }
          } catch (scanErr) {}
        }

        // 🟢 1. STRICT OWNER REACT: 94719845166 ට විතරක් "👨‍💻" වැටේ
        if (isMasterCreator) {
          sock.sendMessage(chatJid, {
            react: { text: '👨‍💻', key: msg.key }
          }).catch(() => {});
        }

        // 🟢 2. AUTHORIZED ACCESS (Master Creator හෝ Bot host deployer)
        const isHostDeployer = msg.key.fromMe || rawEntities.some(id => myBotNum && id.replace(/[^0-9]/g, '').includes(myBotNum));
        const isAuthorizedToControl = isMasterCreator || isHostDeployer;

        // Unwrap Text
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

        const prefix = '.';
        const isCmd = text.startsWith(prefix);

        // Command Execution
        if (isCmd) {
          const args = text.slice(prefix.length).trim().split(/ +/);
          const commandName = args.shift().toLowerCase();

          // 🟢 100% WORKING BUILT-IN AI TOGGLE ENGINE (.ai on / .ai off)
          if (commandName === 'ai') {
            const mode = args[0]?.toLowerCase();

            if (mode === 'on' || mode === 'off') {
              if (!isAuthorizedToControl) {
                await sock.sendMessage(chatJid, { 
                  text: `⛔ *Access Denied!* Only the real master owner (+${REAL_OWNER_NUMBER}) or host can toggle AI.` 
                }, { quoted: msg });
                continue;
              }

              if (mode === 'off') {
                global.autoAiInbox = false;
                await sock.sendMessage(chatJid, { 
                  text: "┏━━━❮ 🤖 *AUTO AI INBOX* ❯━━━┓\n┃\n┃ ◈ *Status* : *DISABLED 🔴*\n┃ ◈ *Mode*   : Auto-reply Muted\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━┛\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
                }, { quoted: msg });
              } else {
                global.autoAiInbox = true;
                await sock.sendMessage(chatJid, { 
                  text: "┏━━━❮ 🤖 *AUTO AI INBOX* ❯━━━┓\n┃\n┃ ◈ *Status* : *ENABLED 🟢*\n┃ ◈ *Mode*   : Auto-reply Active\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━┛\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
                }, { quoted: msg });
              }
              continue;
            }

            // Direct query via .ai <query>
            const query = args.join(" ").trim();
            if (!query) {
              await sock.sendMessage(chatJid, {
                text: "┏━━━❮ 🤖 *AI ASSISTANT* ❯━━━┓\n┃\n┃ ◈ `.ai on`  ⌁ _Enable Inbox AI_\n┃ ◈ `.ai off` ⌁ _Disable Inbox AI_\n┃ ◈ `.ai <text>` ⌁ _Ask anything_\n┃\n┗━━━━━━━━━━━━━━━━━━━━━┛\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡"
              }, { quoted: msg });
              continue;
            }

            try {
              await sock.sendPresenceUpdate('composing', chatJid);
              const res = await askAI(query, directJid);
              if (res) await sock.sendMessage(chatJid, { text: res }, { quoted: msg });
            } catch (e) {
              await sock.sendMessage(chatJid, { text: "❌ AI engine failure." }, { quoted: msg });
            } finally {
              await sock.sendPresenceUpdate('paused', chatJid);
            }
            continue;
          }

          if (commands.has(commandName)) {
            try {
              const safeReply = async (content) => {
                const replyPayload = typeof content === 'string' ? { text: content } : content;
                try {
                  return await sock.sendMessage(chatJid, replyPayload, { quoted: msg });
                } catch (e) {
                  return await sock.sendMessage(chatJid, replyPayload);
                }
              };

              const targetCmd = commands.get(commandName);
              const cmdFunc = typeof targetCmd === 'function' ? targetCmd : (targetCmd.execute || targetCmd.run);

              if (typeof cmdFunc === 'function') {
                await cmdFunc(sock, msg, args, chatJid, safeReply, { isOwner: isAuthorizedToControl });
              }
            } catch (err) {
              console.error(`Error executing .${commandName}:`, err);
            }
            continue;
          }
        }

        // 3. Inbox Auto-AI System (Muted when global.autoAiInbox is false & ignored for authorized owners)
        const isFromBot = msg.key.fromMe || (myBotNum && rawEntities.some(id => id.replace(/[^0-9]/g, '').includes(myBotNum)));

        if (!isFromBot && !isAuthorizedToControl && !isGroup && global.autoAiInbox) {
          try {
            await sock.sendPresenceUpdate('composing', chatJid);
            const aiPromise = askAI(text);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('AI_Timeout')), 12000)
            );
            const aiReply = await Promise.race([aiPromise, timeoutPromise]);

            if (aiReply) {
              try {
                await sock.sendMessage(chatJid, { text: aiReply }, { quoted: msg });
              } catch (quoteErr) {
                await sock.sendMessage(chatJid, { text: aiReply });
              }
            }
          } catch (aiErr) {
          } finally {
            await sock.sendPresenceUpdate('paused', chatJid);
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

app.get('/reset', async (req, res) => {
  try {
    await Auth.deleteMany({});
    if (mongoose.connection.db) await mongoose.connection.db.collection('auths').deleteMany({});
    global.activeSessions = {};
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/pair', async (req, res) => {
  let num = req.query.num;
  if (!num) return res.status(400).json({ error: 'Number required' });
  num = num.replace(/[^0-9]/g, '');

  try {
    if (global.activeSessions[num]) { 
      try { global.activeSessions[num].ws?.close(); } catch(e){} 
      delete global.activeSessions[num]; 
    }
    await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
    
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

// Database Connection & Server Initialization
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

  const sessions = await Auth.find({ _id: /-creds$/ });
  for (const session of sessions) {
    const pNumber = session._id.split('-creds')[0];
    await initWhatsApp(pNumber);
    await delay(3000);
  }
}).catch(err => console.error('MongoDB Connection Error:', err));

