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

global.botMode = 'public';

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// Message Cache (විනාඩි 15ක් memory එකේ තබා ගනී)
const msgCache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

// 🟢 Command Loader (CommonJS සහ ES Modules දෙකටම ගැළපෙන සේ)
const commands = new Map();
const cmdDir = path.join(__dirname, 'commands');

if (fs.existsSync(cmdDir)) {
  const cmdFiles = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));
  for (const file of cmdFiles) {
    try {
      let cmd = require(`./commands/${file}`);
      // export default සහ module.exports දෙකම හඳුනා ගැනීම
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

// 🟢 Message එකේ ඇතුළත ඇති සැබෑ text එක unwrap කරගන්නා Helper function එක
function getMessageText(m) {
  if (!m) return '';
  // Ephemeral, ViewOnce ආදී wrappers ඉවත් කිරීම
  const realMsg = m.ephemeralMessage?.message || 
                  m.viewOnceMessage?.message || 
                  m.viewOnceMessageV2?.message || 
                  m.documentWithCaptionMessage?.message || 
                  m;

  return realMsg.conversation || 
         realMsg.extendedTextMessage?.text || 
         realMsg.imageMessage?.caption || 
         realMsg.videoMessage?.caption || 
         '';
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
        body { background: #050814; background-image: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #050814 70%); color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; overflow-x: hidden; }
        .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 24px; padding: 40px 30px; width: 100%; max-width: 420px; text-align: center; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5); position: relative; }
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

async function initWhatsApp(phoneNumber) {
  // එකම session එකක් දෙවරක් start වීම වැළැක්වීම
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
        console.log(`⚠️ Connection closed (${phoneNumber}), Status Code: ${statusCode}`);

        // Error 401 (Unauthorized) හෝ 403 හැර අනෙක් අවස්ථාවලදී පමණක් reconnect වේ
        if (statusCode !== DisconnectReason.loggedOut && statusCode !== 401 && statusCode !== 403) {
          setTimeout(() => initWhatsApp(phoneNumber), 5000);
        } else {
          if (typeof clearSessionData === 'function') await clearSessionData();
        }
      } else if (connection === 'open') {
        console.log(`✅ BOT CONNECTED: ${phoneNumber}`);
        
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
├▸ *Mode:* ${global.botMode.toUpperCase()}
│
╰────────────────────────╯
> *Bot is active and listening to commands!* 🚀`.trim();

          await sock.sendMessage(botJid, { 
            image: { url: welcomeImg },
            caption: connectedMsg
          });
        } catch (err) {
          console.error('Welcome message send error:', err.message);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // සියලුම message batches එකින් එක process කිරීම
      for (const msg of messages) {
        if (!msg || !msg.message) continue;

        const chatJid = msg.key.remoteJid;
        const isGroup = chatJid.endsWith('@g.us');
        // Group එකකදී මැසේජ් එක යැවූ සැබෑ පුද්ගලයා ලබා ගැනීම
        const senderJid = isGroup ? msg.key.participant : chatJid;

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
          } catch (e) {
            // Status reaction rate-limit නොසලකා හරින්න
          }
          continue;
        }

        // ─── 2. ANTI-DELETE SYSTEM ───
        const protocolMsg = msg.message.protocolMessage;
        if (protocolMsg && protocolMsg.type === 0) {
          const deletedId = protocolMsg.key.id;
          const cachedMsg = msgCache.get(deletedId);

          if (cachedMsg && cachedMsg.message) {
            const deletedBy = msg.key.participant || chatJid;
            const deletedContent = getMessageText(cachedMsg.message) || "*[Media / Document / Sticker]*";

            const alertText = `⚠️ *[ ANTI-DELETE DETECTED ]* ⚠️\n\n` +
                              `👤 *Deleted By:* @${deletedBy.split('@')[0]}\n` +
                              `💬 *Message:*\n${deletedContent}`;

            await sock.sendMessage(chatJid, { 
              text: alertText, 
              mentions: [deletedBy] 
            }, { quoted: cachedMsg });
          }
          continue;
        }

        // සාමාන්‍ය පණිවිඩ Cache කිරීම
        if (msg.key && msg.key.id) {
          msgCache.set(msg.key.id, msg);
        }

        // ─── 3. COMMAND PARSER ───
        const text = getMessageText(msg.message).trim();
        const prefix = '.';
        
        if (!text.startsWith(prefix)) continue;

        const args = text.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Mode Filter Logic
        const isOwner = msg.key.fromMe;
        const currentMode = global.botMode || 'public';

        if (commandName !== 'mode') {
          if (currentMode === 'private' && !isOwner) continue;
          if (currentMode === 'group' && !isGroup && !isOwner) {
            await sock.sendMessage(chatJid, { text: "⚠️ *Notice:* Commands are restricted to Groups only!" }, { quoted: msg });
            continue;
          }
        }

        // Execute Command
        if (commands.has(commandName)) {
          try {
            const cmd = commands.get(commandName);
            // chatJid වෙත ප්‍රතිචාර යැවීම (Group එකක නම් group එකට, Inbox නම් inbox එකට)
            await cmd.execute(sock, msg, args, chatJid);
          } catch (err) {
            console.error(`Error executing .${commandName}:`, err);
            await sock.sendMessage(chatJid, { text: `❌ Error executing command: ${err.message}` }, { quoted: msg });
          }
        } 
        else if (commandName === 'ai') {
          const query = args.join(" ");
          if (!query) {
            await sock.sendMessage(chatJid, { text: "කරුණාකර ප්‍රශ්නයක් යොමු කරන්න. (උදා: .ai hello)" }, { quoted: msg });
            continue;
          }
          const reply = await askAI(query);
          await sock.sendMessage(chatJid, { text: reply }, { quoted: msg });
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
    activeSessions = {};
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

// Database Connection & Server Initialization
mongoose.connect(MONGODB_URI).then(async () => {
  console.log('🍃 MongoDB Connected!');
  app.listen(port, () => {
    console.log(`🚀 Server on port ${port}`);

    // Self-Ping Keep-Alive
    const keepAliveUrl = process.env.RENDER_EXTERNAL_URL;
    if (keepAliveUrl) {
      setInterval(async () => {
        try {
          await fetch(keepAliveUrl);
          console.log('⚡ Ping sent to maintain uptime');
        } catch (e) {}
      }, 4 * 60 * 1000);
    }
  });

  // කලින් save වූ sessions එක් වරක් පමණක් boot කිරීම
  const sessions = await Auth.find({ _id: /-creds$/ });
  for (const session of sessions) {
    const pNumber = session._id.split('-creds')[0];
    initWhatsApp(pNumber);
    await delay(4000);
  }
}).catch(err => console.error('MongoDB Connection Error:', err));

