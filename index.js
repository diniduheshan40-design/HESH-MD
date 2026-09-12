const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const OpenAI = require('openai');
const pino = require('pino');
const express = require('express');

// Render එක සඳහා Web Server එක
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is Running!'));
app.listen(port, () => console.log(`Server listening on port ${port}`));

// 1. ඔබේ OpenRouter API Key එක මෙතැනට කෙලින්ම දමා ඇත
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: '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',
});

// 2. ඔබේ දුරකථන අංකය මෙතැනට දමා ඇත
const phoneNumber = '94705836838';

async function askAI(prompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [{ role: 'user', content: prompt }],
    });
    return completion.choices[0].message.content;
  } catch (err) {
    console.error('AI Error:', err);
    return 'සමාවෙන්න, මට AI එකෙන් පිළිතුරක් ලබාගැනීමට නොහැකි විය.';
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  // පළමු වරට WhatsApp එකට Link කිරීම සඳහා Pairing Code එක ලබා ගැනීම
  if (!sock.authState.creds.registered) {
    await delay(3000); // Server එක පටන් ගන්නා තෙක් තත්පර 3ක් රැඳී සිටී
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log('====================================');
      console.log(`ඔබේ WHATSAPP PAIRING CODE එක: ${code}`);
      console.log('====================================');
    } catch (error) {
      console.error('Pairing code ලබා ගැනීමේ දෝෂයකි:', error);
    }
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed. නැවත සම්බන්ධ වෙමින්...', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('Bot සාර්ථකව WhatsApp එකට සම්බන්ධ විය!');
    }
  });

  // මැසේජ් ලැබුණු විට ක්‍රියාත්මක වීම
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    // .ai [ප්‍රශ්නය] ලෙස එවූ විට
    if (text && text.startsWith('.ai ')) {
      const query = text.replace('.ai ', '').trim();
      const aiReply = await askAI(query);
      await sock.sendMessage(sender, { text: aiReply }, { quoted: msg });
    }
  });
}

startBot();
