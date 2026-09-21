// ============================================================================
// ⚡ 100% WORKING PAIR ROUTE (NO PREMATURE SOCKET CLOSE)
// ============================================================================

function registerPairRoute(app) {
  app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.status(400).json({ error: 'Number required' });
    num = num.replace(/[^0-9]/g, '');

    // 1. පරණ sockets සහ auth data clean කිරීම
    stopAndRemoveSession(num);
    await Auth.deleteMany({ _id: new RegExp('^' + num, 'i') });
    await SettingsModel.findByIdAndUpdate(num, { $set: { isFirstConnectDone: false } }, { upsert: true }).catch(() => {});
    clearSettingsCache(num);

    let pairSock = null;
    let codeSent = false;

    try {
      const { state, saveCreds, clearSessionData } = await useMongoDBAuthState(num);
      const logger = pino({ level: 'silent' });
      
      // WhatsApp default Web client signature (Pairing handshake එක fail නොවීමට)
      pairSock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
        logger,
        printQRInTerminal: false,
        browser: ['Chrome (Linux)', '', ''], // Official desktop web client spoof
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        syncFullHistory: false
      });

      // ⚡ වැදගත්ම දේ: Pairing socket එක activeSessions එකට register කරලා තියන්න
      activeSessions[num] = pairSock;

      pairSock.ev.on('creds.update', saveCreds);

      // Connection state listener
      pairSock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
          console.log(`🎉 Session linked & connected for +${num}!`);
          registerConnectionUpdateHandler(pairSock, num, clearSessionData);
          registerMessageUpsertHandler(pairSock, num);
          handleConnectionOpen(pairSock, num);
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          console.log(`Pairing update close code: ${statusCode}`);

          // Code එක ගහපු ගමන් එන 515 (restart required) හෝ normal disconnects
          if (statusCode === DisconnectReason.restartRequired || statusCode === 515 || statusCode === 428) {
            console.log(`🔄 Handshake complete! Initializing bot for +${num}...`);
            setTimeout(() => initWhatsApp(num), 2000);
          } else if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            delete activeSessions[num];
            await clearSessionData();
          }
        }
      });

      // Socket එක WhatsApp server එකට connect වෙන්න තත්පර 3ක් ඉඩ දෙන්න
      await delay(3000);

      if (!pairSock.authState.creds.registered) {
        let code = await pairSock.requestPairingCode(num);
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        codeSent = true;
        
        // Code එක යවන්න, නමුත් socket එක කිසිසේත්ම close කරන්න එපා!
        return res.json({ code });
      } else {
        return res.status(400).json({ error: 'Session slot conflict. Refresh and try again.' });
      }

    } catch (err) {
      console.error(`❌ Pair code error for +${num}:`, err.message);
      if (pairSock && !codeSent) {
        stopAndRemoveSession(num);
      }
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Server busy. Please try again in 10 seconds.' });
      }
    }
  });
}

