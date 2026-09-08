import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const phoneNumber = process.env.PHONE_NUMBER;

async function askOpenRouter(userPrompt) {
    try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "meta-llama/llama-3.3-70b-instruct:free",
                messages: [
                    { role: "system", content: "ඔබ සුහදශීලී WhatsApp AI සහායකයෙකි. පිළිතුරු සිංහලෙන් හෝ අදාළ භාෂාවෙන් කෙටියෙන් ලබා දෙන්න." },
                    { role: "user", content: userPrompt }
                ]
            })
        });
        const data = await res.json();
        return data.choices?.[0]?.message?.content || "මට පිළිතුරක් ලබා ගැනීමට නොහැකි විය.";
    } catch (e) {
        console.error("AI Error:", e);
        return "දෝෂයක් සිදු විය.";
    }
}

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
            const aiReply = await askOpenRouter(text);
            await sock.sendMessage(sender, { text: aiReply });
        }
    });
}

startBot();
