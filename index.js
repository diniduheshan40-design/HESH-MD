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

// 🟢 Config ෆයිල් එක සම්බන්ධ කිරීම 
const { MONGODB_URI, BOT_NAME } = require('./config');

const { useMongoDBAuthState, Auth } = require('./auth');
const { askAI } = require('./ai');

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// Command Loader
const commands = new Map();
const cmdFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'));
for (const file of cmdFiles) {
  const cmd = require(`./commands/${file}`);
  commands.set(cmd.name, cmd);
}

// Premium Glassmorphism UI
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
        body { background: #050814; background-image: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #050814 70%); color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; overflow-x: hidden; }
        .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 24px; padding: 40px 30px; width: 100%; max-width: 420px; text-align: center; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5); position: relative; }
        .glass-panel::before { content: ""; position: absolute; top: -50px; left: -50px; width: 100px; height: 100px; background: #38bdf8; filter: blur(80px); border-radius: 50%; z-index: -1; }
        .glass-panel::after { content: ""; position: absolute; bottom: -50px; right: -50px; width: 100px; height: 100px; background: #818cf8; filter: blur(80px); border-radius: 50%; z-index: -1; }
        .title { font-size: 26px; font-weight: 800; background: linear-gradient(90deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
        .subtitle { font-size: 13px; color: #94a3b8; margin-bottom: 25px; }
        input { width: 100%; padding: 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.3); color: #38bdf8; font-size: 16px; text-align: center; margin-bottom: 20px; outline: none; transition: 0.3s; letter-spacing: 1px; }
        input:focus { border-color: #38bdf8; box-shadow: 0 0 15px rgba(56, 189, 248, 0.2); }
        button { width: 100%; padding: 16px; border-radius: 14px; border: none; background: linear-gradient(90deg, #38bdf8, #818cf8); color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; transition: 0.3s; margin-bottom: 12px; letter-spacing: 0.5px; }
        button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(56, 189, 248, 0.4); }
        button:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
        .btn-reset { background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); color: #f43f5e; }
        .btn-reset:hover { background: rgba(244, 63, 94, 0.2); box-shadow: 0 10px 25px rgba(244, 63, 94, 0.2); }
        .code-display { font-family: 'JetBrains Mono', monospace; font-size: 34px; font-weight: 800; color: #38bdf8; letter-spacing: 8px; margin-top: 25px; text-shadow: 0 0 20px rgba(56, 189, 248, 0.4); display: none; }
        .toast { position: fixed; top: 20px; right: -100%; background: rgba(16, 185, 129, 0.9); backdrop-filter: blur(10px); color: white; padding: 16px 24px; border-radius: 12px; font-weight: 600; font-size: 14px; transition: 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55); display: flex; align-items: center; gap: 10px; z-index: 1000; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .toast.show { right: 20px; }
      </style>
    </head>
    <body>
      <div id="toast" class="toast">✅ <span id="toast-msg">Copied successfully!</span></div>
      
      <div class="glass-panel">
        <h1 class="title">${BOT_NAME}</h1>
        <p class="subtitle">Enter your number to get the Auto-Copy Pairing Code</p>
        
        <input type="text" id="phone" placeholder="9470xxxxxxx" />
        
        <button id="btn" onclick="getCode()">GENERATE PAIR CODE</button>
        <button class="btn-reset" onclick="resetDB()">RESET DATABASE</button>
        
        <div class="code-display" id="codeBox"></div>
      </div>

      <script>
        function showToast(message) {
          const toast = document.getElementById('toast');
          document.getElementById('toast-msg').innerText = message;
          toast.classList.add('show');
          setTimeout(() => toast.classList.remove('show'), 3500);
        }

        async function getCode() {
          const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
          if (!phone) return showToast('❌ Please enter a valid number!');
          
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
              
              try {
                await navigator.clipboard.writeText(data.code);
                showToast('✅ Pairing Code Auto-Copied!');
              } catch(err) {
                showToast('✅ Code Generated! (Please copy manually)');
              }
            } else {
              showToast('❌ ' + (data.error || 'Error occurred!'));
            }
          } catch(e) { 
            showToast('❌ Server Connection Error!'); 
          }
          
          btn.innerText = 'GENERATE PAIR CODE';
          btn.disabled = false;
        }

        async function resetDB() {
          if(confirm('පැරණි දෝෂ සහිත දත්ත සියල්ල මකා දැමීමට අවශ්‍යද?')) {
            try {
              await fetch('/reset');
              showToast('✅ Database Reset Successful!');
              setTimeout(() => location.reload(), 2000);
            } catch(e) { showToast('❌ Reset Failed!'); }
          }
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
  console.log(`[System] Using WhatsApp Web Version v${version.join('.')}`);

  const sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger, 
    printQRInTerminal: false, 
    browser: ['Ubuntu', 'Chrome', '110.0.5563.148'], 
    msgRetryCounterCache,
    syncFullHistory: false // මින් පෙර මෙහි තිබූ generateHighQualityLinkPreview දෝෂය විසඳීමට ඉවත් කරන ලදී.
  });

  activeSessions[phoneNumber] = sock;
  sock.ev.on('creds.update', saveCreds);
  
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      delete activeSessions[phoneNumber];
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut && code !== 401 && code !== 403) {
        setTimeout(() => initWhatsApp(phoneNumber), 5000);
      } else {
        if (typeof clearSessionData === 'function') await clearSessionData();
      }
    } else if (connection === 'open') {
      console.log(`✅ BOT CONNECTED: ${phoneNumber}`);
      
      try {
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const connectedMsg = `*🎉 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬 𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗘𝗗!*\n\nWelcome to *${BOT_NAME}*. Your intelligent bot system is now active and running perfectly.\n\n👤 *Number:* ${phoneNumber}\n🤖 *AI Engine:* Google Gemini\n\n> ${BOT_NAME} AI SYSTEM 🚀`;
        await sock.sendMessage(botJid, { text: connectedMsg });
      } catch (err) {
        console.error('Welcome message error:', err);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    
    if (!msg.message) return; 

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    const prefix = '.';
    
    if (msg.key.fromMe && !text.startsWith(prefix)) return; 

    if (text.startsWith(prefix)) {
      const args = text.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      
      if (commands.has(commandName)) {
        await commands.get(commandName).execute(sock, msg, args, sender);
      } 
      else if (commandName === 'ai') {
        const query = args.join(" ");
        if(!query) return sock.sendMessage(sender, { text: "කරුණාකර ප්‍රශ්නයක් යොමු කරන්න. (උදා: .ai hello)" }, { quoted: msg });
        const reply = await askAI(query);
        await sock.sendMessage(sender, { text: reply }, { quoted: msg });
      }
    } 
  });
  return sock;
}

app.get('/reset', async (req, res) => {
  try {
    await Auth.deleteMany({});
    if (mongoose.connection.db) await mongoose.connection.db.collection('auths').deleteMany({});
    activeSessions = {};
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/pair', async (req, res) => {
  let num = req.query.num;
  if (!num) return res.status(400).json({ error: 'Number required' });
  try {
    if (activeSessions[num]) { try { activeSessions[num].ws?.close(); } catch(e){} delete activeSessions[num]; }
    await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
    
    const sock = await initWhatsApp(num);
    if (!sock.authState.creds.registered) {
      await delay(3000);
      const code = await Promise.race([sock.requestPairingCode(num), new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 15000))]);
      return res.json({ code: code?.match(/.{1,4}/g)?.join("-") || code });
    } else return res.status(400).json({ error: 'Already Linked! (Bot Active)' });
  } catch (err) { return res.status(500).json({ error: 'Rate Limited! Retry later.' }); }
});

// Database Connection
mongoose.connect(MONGODB_URI).then(async () => {
  console.log('🍃 MongoDB Connected!');
  app.listen(port, () => console.log(`🚀 Server on port ${port}`));
  const sessions = await Auth.find({ _id: /-creds$/ });
  for (const session of sessions) {
      initWhatsApp(session._id.split('-creds')[0]);
      await delay(3000);
  }
}).catch(err => console.log('MongoDB Connection Error:', err));

