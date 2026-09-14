module.exports = {
    name: 'alive',
    async execute(sock, msg, args, sender) {
        await sock.sendMessage(sender, { text: "*👋 HESH-MD V2 IS ALIVE!* 🚀\nSystem is fully operational." }, { quoted: msg });
    }
};

