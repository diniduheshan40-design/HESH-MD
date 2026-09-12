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
  Browsers,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// OpenRouter AI Setup
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
    return 'සමාවෙන්න, මට AI එකෙන් පිළිතුර ලබාගැනීමට නොහැකි විය.';
  }
}

// Ultra-Modern Cyberpunk / Glassmorphic UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WHATSAPP AI BOT • PAIRING PORTAL</title>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Space Grotesk', sans-serif; }
        body {
          background: radial-gradient(circle at top center, #0d1926 0%, #050811 100%);
          color: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
          overflow-x: hidden;
        }
        .container {
          background: rgba(16, 24, 40, 0.75);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 20px;
          padding: 36px 28px;
          max-width: 440px;
          width: 100%;
          box-shadow: 0 0 40px rgba(0, 255, 136, 0.12), inset 0 0 20px rgba(0, 255, 136, 0.03);
          text-align: center;
          position: relative;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.3);
          border-radius: 50px;
          font-size: 12px;
          color: #00ff88;
          font-weight: 600;
          letter-spacing: 1px;
          text-transform: uppercase;
          margin-bottom: 16px;
        }
        .badge-dot {
          width: 8px;
          height: 8px;
          background: #00ff88;
          border-radius: 50%;
          box-shadow: 0 0 10px #00ff88;
          animation: pulse 1.8s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        h1 {
          font-size: 26px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 6px;
          letter-spacing: 0.5px;
        }
        .sub {
          color: #94a3b8;
          font-size: 13.5px;
          margin-bottom: 24px;
          line-height: 1.5;
        }
        .input-group {
          margin-bottom: 18px;
          text-align: left;
        }
        .input-group label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
          margin-bottom: 6px;
          display: block;
        }
        .input-wrapper {
          position: relative;
        }
        input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(10, 15, 29, 0.8);
          border: 1px solid #1e293b;
          border-radius: 12px;
          color: #00ff88;
          font-size: 16px;
          font-family: 'JetBrains Mono', monospace;
          letter-spacing: 1px;
          outline: none;
          transition: all 0.3s ease;
        }
        input:focus {
          border-color: #00ff88;
          box-shadow: 0 0 15px rgba(0, 255, 136, 0.25);
        }
        button.btn-submit {
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #00ff88 0%, #00bd68 100%);
          color: #021a0f;
          font-weight: 700;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 15px;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
          box-shadow: 0 6px 20px rgba(0, 255, 136, 0.3);
        }
        button.btn-submit:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 255, 136, 0.45);
        }
        button.btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .code-card {
          display: none;
          margin-top: 24px;
          padding: 20px;
          background: rgba(4, 8, 17, 0.9);
          border: 1px dashed rgba(0, 255, 136, 0.5);
          border-radius: 14px;
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .code-card span {
          font-size: 12px;
          color: #94a3b8;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .pair-code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 28px;
          font-weight: 700;
          color: #00ff88;
          letter-spacing: 6px;
          margin: 12px 0 14px;
          text-shadow: 0 0 15px rgba(0, 255, 136, 0.4);
        }
        .btn-copy {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: 0.2s;
        }
        .btn-copy:hover {
          background: rgba(255, 255, 255, 0.15);
        }
        .footer-text {
          margin-top: 22px;
          font-size: 12px;
          color: #475569;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="badge">
          <div class="badge-dot"></div>
          AI System Online
        </div>
        <h1>WHATSAPP BOT</h1>
        <p class="sub">අංකය ඇතුළත් කර Pairing Code එක ලබාගෙන WhatsApp හරහා Link කරන්න.</p>

        <div class="input-group">
          <label>WhatsApp Number</label>
          <div class="input-wrapper">
            <input type="text" id="phone" value="94705836838" placeholder="9470xxxxxxx" />
          </div>
        </div>

        <button class="btn-submit" id="btn" onclick="getCode()">GENERATE PAIR CODE</button>

        <div class="code-card" id="codeCard">
          <span>Your Pairing Code</span>
          <div class="pair-code" id="codeBox">----</div>
          <button class="btn-copy" id="copyBtn" onclick="copyCode()">Copy Code</button>
        </div>

        <p class="footer-text">Secure End-to-End WebSocket Gateway</p>
      </div>

      <script>
        let currentCode = '';
        async function getCode() {
          const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '');
          if (!phone) return alert('කරුණාකර දුරකථන අංකය ඇතුළත් කරන්න!');
          const btn = document.getElementById('btn');
          btn.innerText = 'GENERATING CODE...';
          btn.disabled = true;

          try {
            const res = await fetch('/pair?num=' + phone);
            const data = await res.json();
            if (data.code) {
              currentCode = data.code;
              document.getElementById('codeBox').innerText = data.code;
              document.getElementById('codeCard').style.display = 'block';
            } else {
              alert(data.error || 'Pairing code ලබාගැනීම අසාර්ථක විය!');
            }
          } catch(e) {
            alert('Server සම්බන්ධතා දෝෂයකි! කරුණාකර මොහොතකින් නැවත උත්සාහ කරන්න.');
          }
          btn.innerText = 'GENERATE PAIR CODE';
          btn.disabled = false;
        }

        function copyCode() {
          if (!currentCode) return;
          navigator.clipboard.writeText(currentCode);
          const copyBtn = document.getElementById('copyBtn');
          copyBtn.innerText = 'COPIED!';
          setTimeout(() => copyBtn.innerText = 'Copy Code', 2000);
        }
      </script>
    </body>
    </html>
  `);
});

let sock = null;

async function initWhatsApp(phoneNumber = null) {
  const sessionDir = path.join(__dirname, 'session_auth');

  // අලුත් code එකක් ඉල්ලන විට පැරණි auth state එක clear කරයි
  if (phoneNumber && fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0,
    keepAliveIntervalMs: 10000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. Reconnecting...', shouldReconnect);
      if (shouldReconnect) {
        initWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('WhatsApp Bot සාර්ථකව සම්බන්ධ විය!');
    }
  });

  // AI Message Handler
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

  if (phoneNumber && !sock.authState.creds.registered) {
    await delay(3000);
    return await sock.requestPairingCode(phoneNumber);
  }
}

app.get('/pair', async (req, res) => {
  const num = req.query.num;
  if (!num) return res.status(400).json({ error: 'දුරකථන අංකය අවශ්‍යයි' });
  try {
    const code = await initWhatsApp(num);
    return res.json({ code });
  } catch (err) {
    console.error('Pairing Error:', err);
    return res.status(500).json({ error: 'කෝඩ් එක ලබාගැනීම අසාර්ථක විය. නැවත උත්සාහ කරන්න.' });
  }
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
  const credPath = path.join(__dirname, 'session_auth', 'creds.json');
  if (fs.existsSync(credPath)) {
    initWhatsApp();
  }
});
