const express = require('express');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  delay, 
  Browsers 
} = require('@whiskeysockets/baileys');

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// OpenRouter API Setup
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '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',
});

async function askAI(prompt) {
  try {
    const res = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [{ role: 'user', content: prompt }],
    });
    return res.choices[0].message.content;
  } catch (err) {
    console.error('AI Error:', err);
    return 'සමාවෙන්න, පිළිතුර ලබාගැනීමේදී දෝෂයක් මතු විය.';
  }
}

// Web UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WhatsApp Bot Pairing</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
        body { background: #0b0f19; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
        .box { background: #111827; border: 1px solid #1f2937; padding: 30px; border-radius: 12px; max-width: 400px; width: 100%; text-align: center; }
        h2 { color: #00ff88; margin-bottom: 8px; font-size: 22px; }
        p { color: #9ca3af; font-size: 13px; margin-bottom: 20px; }
        input { width: 100%; padding: 12px; background: #1f2937; border: 1px solid #374151; border-radius: 8px; color: #fff; font-size: 16px; outline: none; margin-bottom: 15px; text-align: center; }
        input:focus { border-color: #00ff88; }
        button { width: 100%; padding: 12px; background: #00ff88; color: #052e16; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; }
        .result { margin-top: 20px; padding: 15px; background: #030712; border: 1px dashed #00ff88; border-radius: 8px; display: none; }
        .code { font-size: 26px; font-weight: bold; letter-spacing: 4px; color: #00ff88; margin-top: 6px; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>WHATSAPP BOT SETUP</h2>
        <p>WhatsApp අංකය රටේ කේතය සමඟ ඇතුළත් කරන්න</p>
        <input type="text" id="phone" placeholder="94705836838" value="94705836838">
        <button id="btn" onclick="getCode()">GET PAIRING CODE</button>
        <div class="result" id="resBox">
          <span style="font-size:12px; color:#9ca3af;">ඔබගේ Pairing Code එක:</span>
          <div class="code" id="codeText"></div>
          <span style="font-size:11px; color:#10b981; display:block; margin-top:8px;">කෝඩ් එක WhatsApp එකට දමා Link කරන්න!</span>
        </div>
      </div>
      <script>
        async function getCode() {
          const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
          if (!phone) return alert('අංකය ඇතුළත් කරන්න!');
          const btn = document.getElementById('btn');
          btn.innerText = 'රැඳී සිටින්න...';
          btn.disabled = true;
          try {
            const res = await fetch('/pair?num=' + phone);
            const data = await res.json();
            if (data.code) {
              document.getElementById('resBox').style.display = 'block';
              document.getElementById('codeText').innerText = data.code;
            } else {
              alert(data.error || 'Pairing Code ලබා ගැනීමට නොහැකි විය!');
            }
          } catch(e) {
            alert('Server සම්බන්ධතා දෝෂයකි!');
          }
          btn.innerText = 'GET PAIRING CODE';
          btn.disabled = false;
        }
      </script>
    </body>
    </html>
  `);
});

let sock = null;

async function initWhatsApp(phoneNumber = null) {
  const sessionDir = path.join(__dirname, 'session_auth');
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    // WhatsApp Pairing Code එක වැඩ කිරීමට අනිවාර්ය Browser Config එක
    browser: Browsers.macOS('Desktop'),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting...', shouldReconnect);
      if (shouldReconnect) initWhatsApp();
    } else if (connection === 'open') {
      console.log('Bot සාර්ථකව WhatsApp එකට සම්බන්ධ විය!');
    }
  });

  // AI Message Handler (.ai විධානය සඳහා)
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (text && text.startsWith('.ai ')) {
      const query = text.replace('.ai ', '').trim();
      const reply = await askAI(query);
      await sock.sendMessage(sender, { text: reply }, { quoted: msg });
    }
  });

  // Pairing Code ඉල්ලීම
  if (phoneNumber && !sock.authState.creds.registered) {
    await delay(3000);
    return await sock.requestPairingCode(phoneNumber);
  }
}

// Pairing Endpoint
app.get('/pair', async (req, res) => {
  const num = req.query.num;
  if (!num) return res.status(400).json({ error: 'දුරකථන අංකය අවශ්‍යයි' });
  try {
    const code = await initWhatsApp(num);
    return res.json({ code });
  } catch (err) {
    console.error('Pairing Error:', err);
    return res.status(500).json({ error: 'Code එක ලබාගැනීමට නොහැකි විය. පසුව උත්සාහ කරන්න.' });
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
  // කලින් Link කර ඇත්නම් පමණක් auto connect වේ
  const credPath = path.join(__dirname, 'session_auth', 'creds.json');
  if (fs.existsSync(credPath)) {
    initWhatsApp();
  }
});

