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

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// 🟢 Command Loader
const commands = new Map();
const cmdDir = path.join(__dirname, 'commands');

if (fs.existsSync(cmdDir)) {
  const cmdFiles = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));
  for (const file of cmdFiles) {
    try {
      let cmd = require(`./commands/${file}`);
      if (cmd.default) cmd = cmd.default;
      if (cmd && cmd.name) {
        commands.set(cmd.name.toLowerCase(), cmd);
        console.log(` Loaded command: .${cmd.name}`);
      }
    } catch (e) {
      console.error(` Error loading ${file}:`, e.message);
    }
  }
}

// Glassmorphism UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${BOT_NAME} • PORTAL</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&family=JetBrains+Mono:wght@800&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Poppins', sans-serif; }
        body { background: #050814; background-image: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #050814 70%); color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
        .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 24px; padding: 40px 30px; width: 100%; max-width: 420px; text-align: center; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5); }
        .title { font-size: 26px; font-weight: 800; background: linear-gradient(90deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
        .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 25px; }
        input { width: 100%; padding: 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: #38bdf8; font-size: 16px; text-align: center; margin-bottom: 20px; outline: none; }
        button { width: 100%; padding: 16px; border-radius: 14px; border: none; background: linear-gradient(90deg, #38bdf8, #818cf8); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; margin-bottom: 12px; }
        .btn-reset { background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); color: #f43f5e; }
        .code-display { font-family: 'JetBrains Mono', monospace; font-size: 30px; font-weight: 800; color: #38bdf8; letter-spacing: 6px; margin-top: 25px; display: none; }
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
          document.getElementById('btn').innerText = 'GENERATING...';
          try {
            const res = await fetch('/pair?num=' + phone);
            const data = await res.json();
            if (data.code) {
              const el = document.getElementById('codeBox');
              el.innerText = data.code;
              el.style.display = 'block';
              navigator.clipboard.writeText(data.code);
              alert('Code copied: ' + data.code);
            } else {
              alert(data.error || 'Error generating code');
            }
          } catch(e) { alert('Server error'); }
          document.getElementById('btn').innerText = 'GENERATE PAIR CODE';
        }
        async function resetDB() {
          if (confirm('Clear session data?')) {
            await fetch('/reset');
            location.reload();
          }
        }
      </script>
    </body>
    </html>
  `);
});

let activeSessions = {};
let isStarting = {};
// Connecting Message එක එක්වරක් පමණක් යැවීමට Track කරන Set එක
const welcomedNumbers = new Set();

async function initWhatsApp(phoneNumber) {
  if (activeSessions[phoneNumber]) return activeSessions[phoneNumber];
  if (isStarting[phoneNumber]) return;
  isStarting[phoneNumber] = true;

  try {
    const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(phoneNumber);
    const logger = pino({ level: 'silent' });
    const msgRetryCounterCache = new NodeCache();
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      logger, 
      printQRInTerminal: false, 
      browser: Browsers.ubuntu('Chrome'), 
      msgRetryCounterCache,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false
    });

    activeSessions[phoneNumber] = sock;
    delete isStarting[phoneNumber];

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'close') {
        delete activeSessions[phoneNumber];
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(`⚠️ Connection closed (${phoneNumber}), Code: ${statusCode}`);

        if (statusCode !== DisconnectReason.loggedOut && statusCode !== 401 && statusCode !== 403) {
          setTimeout(() => initWhatsApp(phoneNumber), 5000);
        } else {
          welcomedNumbers.delete(phoneNumber);
          if (typeof clearSessionData === 'function') await clearSessionData();
        }
      } else if (connection === 'open') {
        console.log(`✅ BOT CONNECTED: ${phoneNumber}`);
        
        // එක් වරක් පමණක් Connecting Message යැවීම (Spam Loop Fix)
        if (!welcomedNumbers.has(phoneNumber)) {
          welcomedNumbers.add(phoneNumber);
          try {
            const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const welcomeImg = 'https://files.catbox.moe/a58add.jpeg';

            const connectedMsg = `
╭───〔 ⚡ *SYSTEM INITIALIZED* ⚡ 〕───╮
│
├▸ *Status:* Online & Operational 🟢
├▸ *Bot Name:* ${BOT_NAME}
├▸ *Connected:* +${phoneNumber}
├▸ *Engine:* HESHAN-MD V2
├▸ *Auto Status:* Active 💐
│
╰────────────────────────╯
> *Bot is active and listening to commands!* 🚀`.trim();

            await sock.sendMessage(botJid, { 
              image: { url: welcomeImg },
              caption: connectedMsg
            });
          } catch (err) {
            console.error('Welcome message error:', err.message);
          }
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      const msg = messages[0];
      if (!msg || !msg.message) return;

      const chatJid = msg.key.remoteJid;

      // ─── 1. AUTO STATUS SEEN & REACTION (💐) ───
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
        return;
      }

      // ─── 2. COMMAND SYSTEM (FOR ALL CHATS & GROUPS) ───
      const text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        ''
      ).trim();

      const prefix = '.';
      if (!text.startsWith(prefix)) return;

      const args = text.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

      // සියලු දෙනාටම (Private/Group) කමාන්ඩ් execute වීම
      if (commands.has(commandName)) {
        try {
          await commands.get(commandName).execute(sock, msg, args, chatJid);
        } catch (err) {
          console.error(`Error running .${commandName}:`, err);
        }
      } 
      else if (commandName === 'ai') {
        const query = args.join(" ");
        if (!query) return sock.sendMessage(chatJid, { text: "කරුණාකර ප්‍රශ්නයක් යොමු කරන්න. (උදා: .ai hello)" }, { quoted: msg });
        const reply = await askAI(query);
        await sock.sendMessage(chatJid, { text: reply }, { quoted: msg });
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
    activeSessions = {};
    welcomedNumbers.clear();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/pair', async (req, res) => {
  let num = req.query.num;
  if (!num) return res.status(400).json({ error: 'Number required' });
  try {
    if (activeSessions[num]) { 
      try { activeSessions[num].ws?.close(); } catch(e){} 
      delete activeSessions[num]; 
    }
    await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
    
    const sock = await initWhatsApp(num);
    if (!sock) return res.status(500).json({ error: 'Failed to init socket' });

    if (!sock.authState.creds.registered) {
      await delay(3000);
      const code = await Promise.race([
        sock.requestPairingCode(num), 
        new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 15000))
      ]);
      return res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });
    } else {
      return res.status(400).json({ error: 'Already Linked! (Bot Active)' });
    }
  } catch (err) { 
    return res.status(500).json({ error: 'Rate Limited or Timeout! Retry later.' }); 
  }
});

// Database Connection & Server Start
mongoose.connect(MONGODB_URI).then(async () => {
  console.log('🍃 MongoDB Connected!');
  app.listen(port, () => {
    console.log(`🚀 Server on port ${port}`);

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
    initWhatsApp(pNumber);
    await delay(4000);
  }
}).catch(err => console.error('MongoDB Connection Error:', err));

