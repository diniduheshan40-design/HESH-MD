const express = require('express');
const pino = require('pino');
const mongoose = require('mongoose');
const NodeCache = require('node-cache');
const { 
  default: makeWASocket, 
  DisconnectReason, 
  delay, 
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const config = require('./config');
const { useMongoDBAuthState, Auth } = require('./auth');
const { askAI } = require('./ai');

const app = express();
const port = config.PORT;
const BOT_NAME = config.BOT_NAME;

app.use(express.json());

// UI Portal
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${BOT_NAME} • PAIR PORTAL</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&family=JetBrains+Mono:wght@800&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Poppins', sans-serif; }
        body { background: #050814; background-image: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #050814 70%); color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; overflow-x: hidden; }
        .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 40px 30px; width: 100%; max-width: 420px; text-align: center; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.6); position: relative; }
        .glass-panel::before { content: ""; position: absolute; top: -40px; left: -40px; width: 100px; height: 100px; background: #38bdf8; filter: blur(70px); border-radius: 50%; z-index: -1; }
        .glass-panel::after { content: ""; position: absolute; bottom: -40px; right: -40px; width: 100px; height: 100px; background: #818cf8; filter: blur(70px); border-radius: 50%; z-index: -1; }
        .title { font-size: 28px; font-weight: 800; background: linear-gradient(90deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 6px; }
        .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
        input { width: 100%; padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.4); color: #38bdf8; font-size: 16px; text-align: center; margin-bottom: 18px; outline: none; transition: 0.3s; }
        input:focus { border-color: #38bdf8; box-shadow: 0 0 15px rgba(56, 189, 248, 0.3); }
        button { width: 100%; padding: 15px; border-radius: 12px; border: none; background: linear-gradient(90deg, #38bdf8, #818cf8); color: #050814; font-size: 15px; font-weight: 700; cursor: pointer; transition: 0.3s; margin-bottom: 10px; }
        button:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(56, 189, 248, 0.4); }
        button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .code-display { font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 800; color: #38bdf8; letter-spacing: 6px; margin-top: 22px; text-shadow: 0 0 20px rgba(56, 189, 248, 0.5); display: none; }
      </style>
    </head>
    <body>
      <div class="glass-panel">
        <h1 class="title">${BOT_NAME}</h1>
        <p class="subtitle">Enter WhatsApp number with country code</p>
        
        <input type="text" id="phone" placeholder="9474xxxxxxx" />
        <button id="btn" onclick="getCode()">GET PAIRING CODE</button>
        
        <div class="code-display" id="codeBox"></div>
      </div>

      <script>
        async function getCode() {
          const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
          if (!phone) return alert('❌ Please enter a valid number!');
          
          const btn = document.getElementById('btn');
          btn.innerText = 'GENERATING CODE...';
          btn.disabled = true;
          
          try {
            const res = await fetch('/pair?num=' + phone);
            const data = await res.json();
            
            if (data.code) {
              const codeEl = document.getElementById('codeBox');
              codeEl.innerText = data.code;
              codeEl.style.display = 'block';
              navigator.clipboard.writeText(data.code);
              alert('✅ Code copied! Go to WhatsApp > Linked Devices > Link with phone number.');
            } else {
              alert('❌ ' + (data.error || 'Pairing error!'));
            }
          } catch(e) { 
            alert('❌ Server Connection Error!'); 
          }
          
          btn.innerText = 'GET PAIRING CODE';
          btn.disabled = false;
        }
      </script>
    </body>
    </html>
  `);
});

let activeSessions = {};

async function initWhatsApp(phoneNumber) {
  if (activeSessions[phoneNumber]) return activeSessions[phoneNumber];
  
  const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(phoneNumber);
  const logger = pino({ level: 'silent' });
  const msgRetryCounterCache = new NodeCache();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger, 
    printQRInTerminal: false, 
    browser: ['Ubuntu', 'Chrome', '110.0.5563.148'], 
    msgRetryCounterCache,
    syncFullHistory: false
  });

  activeSessions[phoneNumber] = sock;
  sock.ev.on('creds.update', saveCreds);
  
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      delete activeSessions[phoneNumber];
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut && code !== 401) {
        setTimeout(() => initWhatsApp(phoneNumber), 5000);
      } else {
        await clearSessionData();
      }
    } else if (connection === 'open') {
      console.log(`✅ [${BOT_NAME}] CONNECTED: ${phoneNumber}`);
    }
  });

  // Incoming Message AI Handler
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || 
                 msg.message.imageMessage?.caption;

    if (!text) return;

    try {
      await sock.sendPresenceUpdate('composing', sender);
      const reply = await askAI(text);
      await sock.sendMessage(sender, { text: reply }, { quoted: msg });
      await sock.sendPresenceUpdate('paused', sender);
    } catch (e) {
      console.error('Send Error:', e);
    }
  });

  return sock;
}

app.get('/pair', async (req, res) => {
  let num = req.query.num;
  if (!num) return res.status(400).json({ error: 'Number required' });
  try {
    if (activeSessions[num]) { 
      try { activeSessions[num].ws?.close(); } catch(e){} 
      delete activeSessions[num]; 
    }
    
    const sock = await initWhatsApp(num);
    if (!sock.authState.creds.registered) {
      await delay(3000);
      const code = await sock.requestPairingCode(num);
      return res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });
    } else {
      return res.status(400).json({ error: 'Already Connected!' });
    }
  } catch (err) { 
    return res.status(500).json({ error: 'Pairing failed. Try again!' }); 
  }
});

// Start DB & Reconnect all active sessions
mongoose.connect(config.MONGODB_URI).then(async () => {
  console.log('🍃 MongoDB Connected!');
  app.listen(port, () => console.log(`🚀 ${BOT_NAME} Live on port ${port}`));
  
  const sessions = await Auth.find({ _id: /-creds$/ });
  for (const session of sessions) {
    const pNumber = session._id.split('-creds')[0];
    initWhatsApp(pNumber);
    await delay(3000);
  }
}).catch(err => console.log('MongoDB Connection Error:', err));

