import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const phoneNumber = process.env.PHONE_NUMBER;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_auth');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    if (!sock.authState.creds.registered && phoneNumber) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n=============================\nඔබේ WhatsApp Pairing Code එක: ${code}\n=============================\n`);
            } catch (err) {
                console.error('Pairing code error:', err);
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', reconnect);
            if (reconnect) startBot();
        } else if (connection === 'open') {
            console.log('WhatsApp Bot එක සාර්ථකව Connect විය!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (text) {
            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: text,
                    config: {
                        systemInstruction: 'ඔබ සුහදශීලී සහ කෙටියෙන් පිළිතුරු දෙන WhatsApp AI සහායකයෙකි.'
                    }
                });

                await sock.sendMessage(sender, { text: response.text });
            } catch (err) {
                console.error('AI Error:', err);
            }
        }
    });
}

startBot();
