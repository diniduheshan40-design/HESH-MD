const { cmd } = require('../command');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

cmd({
    pattern: "reaction",
    alias: ["reacts", "emoji"],
    desc: "Animated emoji reactions",
    category: "fun",
    filename: __filename
},
async(conn, mek, m, { from, q, reply }) => {
    try {
        // Command එකට ✨ react කරනවා
        await conn.sendMessage(from, { react: { text: "✨", key: mek.key } });

        const type = q ? q.toLowerCase().trim() : 'lol';
        let frames = [];

        if (type === 'love') {
            frames = ['🤍', '🤎', '💜', '💙', '🩵', '💚', '💛', '🧡', '❤️', '💖', '💝', '✨ *I LOVE YOU!* ✨'];
        } else if (type === 'sad') {
            frames = ['🙂', '😐', '🙁', '☹️', '🥺', '😢', '😭', '💔 *HEART BROKEN* 💔'];
        } else {
            // Default is 'lol'
            frames = ['🙂', '😄', '😃', '😁', '😆', '😂', '🤣', '💀 *DEAD FROM LAUGHTER!* 💀'];
        }

        // මුල් message එක යැවීම
        let sent = await conn.sendMessage(from, { text: frames[0] }, { quoted: mek });

        // Edit කරමින් animation එක පෙන්වීම
        for (let i = 1; i < frames.length; i++) {
            await delay(700);
            try {
                await conn.sendMessage(from, {
                    text: frames[i],
                    edit: sent.key
                });
            } catch (err) {
                // Edit error ආවොත් skip කරයි
            }
        }

    } catch (e) {
        console.error('Reaction Error:', e);
        reply(`Error: ${e.message}`);
    }
});
