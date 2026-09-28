const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { delay, DisconnectReason } = require('@whiskeysockets/baileys');
const { BOT_NAME } = require('../config');
const { Auth } = require('../auth');
const { SettingsModel, getBotSettings, clearSettingsCache } = require('../lib/database');
const { 
  createBaileysSocket, 
  stopAndRemoveSession, 
  initWhatsApp, 
  registerConnectionUpdateHandler, 
  registerMessageUpsertHandler, 
  handleConnectionOpen,
  cleanDigits 
} = require('../lib/socket');

function renderPortalHtml(botName) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${botName} • PAIRING STATION</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=JetBrains+Mono:wght@700;800&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg-black: #060203;
          --panel-card: rgba(18, 5, 8, 0.82);
          --neon-red: #ff003c;
          --deep-red: #990024;
          --crimson-glow: rgba(255, 0, 60, 0.45);
          --card-border: rgba(255, 0, 60, 0.32);
          --input-bg: rgba(10, 2, 4, 0.88);
          --text-bright: #ffffff;
          --text-dim: #a89498;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: var(--bg-black);
          background-image: 
            radial-gradient(circle at 50% 0%, rgba(255, 0, 60, 0.25) 0%, transparent 60%),
            radial-gradient(circle at 100% 100%, rgba(153, 0, 36, 0.2) 0%, transparent 50%);
          color: var(--text-bright);
          font-family: 'Outfit', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .portal-container { width: 100%; max-width: 430px; position: relative; }
        .portal-card {
          background: var(--panel-card);
          backdrop-filter: blur(30px);
          border: 1px solid var(--card-border);
          border-radius: 28px;
          padding: 44px 32px;
          text-align: center;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.9), 0 0 35px rgba(255, 0, 60, 0.25);
        }
        .brand-title {
          font-size: 32px; font-weight: 900; text-transform: uppercase;
          background: linear-gradient(135deg, #ffffff 30%, #ff8097 70%, var(--neon-red) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin-bottom: 6px;
        }
        .brand-subtitle { color: var(--text-dim); font-size: 13.5px; margin-bottom: 30px; }
        .phone-field {
          width: 100%; padding: 18px 22px; background: var(--input-bg);
          border: 1.5px solid var(--card-border); border-radius: 18px;
          color: #ffffff; font-size: 18px; font-weight: 700; text-align: center;
          outline: none; margin-bottom: 20px; transition: 0.3s;
        }
        .phone-field:focus { border-color: var(--neon-red); box-shadow: 0 0 25px rgba(255, 0, 60, 0.4); }
        .btn-generate {
          width: 100%; padding: 18px; border: none; border-radius: 18px;
          background: linear-gradient(135deg, var(--deep-red) 0%, var(--neon-red) 100%);
          color: #fff; font-size: 15px; font-weight: 800; cursor: pointer; text-transform: uppercase;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          transition: 0.2s;
        }
        .btn-generate:disabled { opacity: 0.75; cursor: not-allowed; }
        .spinner {
          display: none;
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .code-panel { display: none; margin-top: 25px; }
        .code-display {
          font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 800;
          letter-spacing: 5px; color: #fff; background: rgba(255, 0, 60, 0.15);
          border: 2px dashed rgba(255, 0, 60, 0.6); border-radius: 18px; padding: 18px;
          margin-bottom: 18px;
        }

        /* ── USER ACCOUNT BAR (PIN/PW & COINS) ── */
        .user-account-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 0, 60, 0.08);
          border: 1px solid rgba(255, 0, 60, 0.35);
          border-radius: 16px;
          padding: 14px 18px;
          backdrop-filter: blur(10px);
        }
        .acc-stat { display: flex; flex-direction: column; text-align: left; }
        .acc-label { font-size: 10px; font-weight: 800; color: #a89498; letter-spacing: 1px; }
        .acc-val { font-size: 13.5px; font-weight: 800; color: #fff; margin-top: 3px; }
        .key-val { color: #ff003c; cursor: pointer; letter-spacing: 1px; font-family: monospace; }
        .coin-box { text-align: right; }
        .coin-val { color: #ffd700; font-size: 14.5px; font-weight: 900; }
      </style>
    </head>
    <body>
      <div class="portal-container">
        <div class="portal-card">
          <h1 class="brand-title">${botName}</h1>
          <p class="brand-subtitle">Enter WhatsApp Number with Country Code</p>
          <input type="tel" id="phone" class="phone-field" placeholder="e.g. 9471xxxxxxx" autofocus />
          <button id="genBtn" class="btn-generate" onclick="generatePairCode()">
            <span class="spinner" id="btnSpinner"></span>
            <span id="btnText">GENERATE PAIR CODE</span>
          </button>
          
          <div class="code-panel" id="codePanel">
            <div class="code-display" id="codeDisplay"></div>
            
            <div class="user-account-bar" id="accountBar">
              <div class="acc-stat">
                <span class="acc-label">BOT NUMBER</span>
                <span class="acc-val" id="dispNum">+9471xxxxxxx</span>
              </div>
              <div class="acc-stat">
                <span class="acc-label">PORTAL KEY (PW)</span>
                <span class="acc-val key-val" id="dispPw" onclick="copyPassword()" title="Click to Copy">
                  ------ 📋
                </span>
              </div>
              <div class="acc-stat coin-box">
                <span class="acc-label">BALANCE</span>
                <span class="acc-val coin-val" id="dispCoins">🪙 0 Coins</span>
              </div>
            </div>
          </div>

        </div>
      </div>
      <script>
        let currentPortalPw = '';

        function copyPassword() {
          if (!currentPortalPw) return;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(currentPortalPw);
            alert('Password Copied: ' + currentPortalPw);
          }
        }

        async function generatePairCode() {
          const phoneInput = document.getElementById('phone');
          const cleanPhone = phoneInput.value.replace(/[^0-9]/g, '');
          if (!cleanPhone || cleanPhone.length < 10) return alert('කරුණාකර නිවැරදි අංකය ලබාදෙන්න!');

          const btn = document.getElementById('genBtn');
          const btnText = document.getElementById('btnText');
          const spinner = document.getElementById('btnSpinner');
          const codePanel = document.getElementById('codePanel');

          btnText.innerText = 'GENERATING...';
          spinner.style.display = 'inline-block';
          btn.disabled = true;
          codePanel.style.display = 'none';

          try {
            const res = await fetch('/pair?num=' + cleanPhone);
            const data = await res.json();
            if (data.code) {
              document.getElementById('codeDisplay').innerText = data.code;
              document.getElementById('dispNum').innerText = '+' + cleanPhone;
              
              currentPortalPw = data.password || 'N/A';
              document.getElementById('dispPw').innerText = currentPortalPw + ' 📋';
              document.getElementById('dispCoins').innerText = '🪙 ' + (data.coins || 0) + ' Coins';

              codePanel.style.display = 'block';
              if (navigator.clipboard) navigator.clipboard.writeText(data.code).catch(()=>{});
            } else { 
              alert(data.error || 'Connection rate-limited.'); 
            }
          } catch(e) { 
            alert('Server error! Please try again.'); 
          } finally { 
            btnText.innerText = 'GENERATE PAIR CODE'; 
            spinner.style.display = 'none';
            btn.disabled = false; 
          }
        }
      </script>
    </body>
    </html>
  `;
}

router.get('/', (req, res) => {
  res.send(renderPortalHtml(BOT_NAME));
});

router.get('/pair', async (req, res) => {
  let num = req.query.num;
  if (!num) return res.status(400).json({ error: 'Number required' });
  num = cleanDigits(num);

  stopAndRemoveSession(num);
  await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') }).catch(() => {});
  await SettingsModel.findByIdAndUpdate(num, { $set: { isFirstConnectDone: false } }, { upsert: true }).catch(() => {});
  clearSettingsCache(num);

  let pairSock = null;

  try {
    const { sock, clearSessionData } = await createBaileysSocket(num);
    pairSock = sock;
    global.activeSessions[num] = pairSock;

    registerConnectionUpdateHandler(pairSock, num, clearSessionData);
    registerMessageUpsertHandler(pairSock, num);

    await delay(3000);

    if (!pairSock.authState.creds.registered) {
      let code = await pairSock.requestPairingCode(num);
      code = code?.match(/.{1,4}/g)?.join('-') || code;

      // Password සහ Coins balance ලබා ගැනීම
      const userSettings = await getBotSettings(num);

      return res.json({ 
        code,
        password: userSettings.botPassword,
        coins: userSettings.coins || 0
      });
    } else {
      await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') }).catch(() => {});
      return res.status(400).json({ error: 'Already registered! Clear session and retry.' });
    }
  } catch (err) {
    if (pairSock) {
      try { pairSock.ws?.close(); } catch(e) {}
    }
    return res.status(500).json({ error: 'Rate-limited or connection error. Wait 15s and retry.' });
  }
});

router.get('/reset', async (req, res) => {
  try {
    await Auth.deleteMany({});
    if (mongoose.connection.db) {
      await mongoose.connection.db.collection('auths').deleteMany({});
    }
    Object.keys(global.activeSessions || {}).forEach(num => stopAndRemoveSession(num));
    res.json({ success: true, message: 'All sessions successfully wiped!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reset-num', async (req, res) => {
  let num = req.query.num;
  if (!num) return res.status(400).json({ error: 'Number required' });
  num = cleanDigits(num);

  try {
    stopAndRemoveSession(num);
    await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') }).catch(() => {});
    return res.json({ success: true, message: `Session cleared for ${num}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
