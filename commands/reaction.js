const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    name: 'reaction',
    async execute(sock, msg, args, sender) {
        const type = args[0]?.toLowerCase() || 'lol';

        let frames = [];

        if (type === 'love') {
            frames = ['🤍', '🤎', '💜', '💙', '🩵', '💚', '💛', '🧡', '❤️', '💖', '💝', '✨ *I LOVE YOU!* ✨'];
        } else if (type === 'sad') {
            frames = ['🙂', '😐', '🙁', '☹️', '🥺', '😢', '😭', '💔 *HEART BROKEN* 💔'];
        } else {
            // Default is 'lol'
            frames = ['🙂', '😄', '😃', '😁', '😆', '😂', '🤣', '💀 *DEAD FROM LAUGHTER!* 💀'];
        }

        let sent = await sock.sendMessage(sender, { text: frames[0] }, { quoted: msg });

        for (let i = 1; i < frames.length; i++) {
            await delay(800);
            await sock.sendMessage(sender, {
                text: frames[i],
                edit: sent.key
            });
        }
    }
};

