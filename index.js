require('dotenv').config();
const express = require('express');
const pino = require('pino');
const mongoose = require('mongoose');
const { 
  default: makeWASocket, 
  DisconnectReason, 
  delay, 
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const { useMongoDBAuthState, Auth } = require('./auth');
const { askAI } = require('./ai');

const app = express();
const port = process.env.PORT || 3000;
const BOT_NAME = process.env.BOT_NAME || 'HESHAN AI BOT';

app.use(express.json());

// Glassmorphism Pair Portal UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${BOT_NAME} • PAIR PORTAL</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
        body { background: #050814; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
        .card { background: rgba(255,255,255,0.05); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 35px 25px; width: 100%; max-width: 400px; text-align: center; }
        h1 { font-size: 24px; color: #38bdf8; margin-bottom: 8px; }
        p { font-size: 13px; color: #94a3b8; margin-bottom: 20px; }
        input { width: 100%; padding: 14px; border-radius: 10px; border: 1px solid #334155; background: rgba(0,0,0,0.3); color: #38bdf8; font-size: 16px; text-align: center; margin-bottom: 15px; outline: none; }
        button { width: 100%; padding: 14px; border-radius: 10px; border: none; background: #38bdf8; color: #050814; font-size: 15px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        button:hover { background: #7dd3fc; }
        .code-box { font-family: monospace; font-size: 28px; font-weight: bold; color: #4ade80; letter-spacing: 4px; margin-top: 20px; display: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>${BOT_NAME}</h1>
        <p>දුරකථන අංකය ඇතුළත් කර Pair Code එක ලබාගන්න</p>
        <input type="text" id="phone" placeholder="9470xxxxxxx" />
        <button id="btn" onclick="getCode()">PAIR WITH WHATSAPP</button>
        <div class="code-box" id="codeBox"></div>
      </div>
      <script>
        async function getCode() {
          const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
          if (!phone) return alert('කරුණාකර අංකය ඇතුළත් කරන්න!');
          const btn = document.getElementById('btn');
          btn.innerText = 'GENERATING...';
          btn.disabled = true;
          try {
            const res = await fetch('/pair?num=' + phone);
            const data = await res.json();
            if (data.code) {
              const el = document.getElementById('codeBox');
              el.innerText = data.code;
              el.style.display = 'block';
              navigator.clipboard.writeText(data.code);
              alert('Code එක Auto Copy විය! WhatsApp Linked Devices වෙත යන්න.');
            } else {
              alert(data.error || 'දෝෂයක් ඇති විය');
            }
          } catch(e) { alert('Server Connection Error!'); }
          btn.innerText = 'PAIR WITH WHATSAPP';
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
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '110.0.5563.148'],
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
      console.log(`✅ BOT CONNECTED: ${phoneNumber}`);
    }
  });

  // AI Auto Reply Handler
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || 
                 msg.message.imageMessage?.caption;

    if (!text) return;

    await sock.sendPresenceUpdate('composing', sender);
    const reply = await askAI(text);
    await sock.sendMessage(sender, { text: reply }, { quoted: msg });
    await sock.sendPresenceUpdate('paused', sender);
  });

  return sock;
}

app.get('/pair', async (req, res) => {
  const num = req.query.num;
  if (!num) return res.status(400).json({ error: 'Phone number required' });
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
    return res.status(500).json({ error: 'Pairing Failed! Try again.' });
  }
});

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('🍃 MongoDB Connected!');
  app.listen(port, () => console.log(`🚀 Server on port ${port}`));

  const sessions = await Auth.find({ _id: /-creds$/ });
  for (const session of sessions) {
    initWhatsApp(session._id.split('-creds')[0]);
    await delay(2000);
  }
}).catch(console.error);

