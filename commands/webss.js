const axios = require('axios');

module.exports = {
    name: "ssweb",
    category: "tools",
    desc: "Take full webpage screenshot",
    async run({ conn, m, args }) {
        let url = args[0];
        if (!url) return await m.reply("කරුණාකර Web Link එකක් ලබා දෙන්න!\nඋදා: `.ssweb https://google.com`");
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

        try {
            await m.reply("Capturing screenshot... 📸");
            let imgUrl = `https://image.thum.io/get/width/1200/crop/800/fullpage/${url}`;
            let res = await axios.get(imgUrl, { responseType: 'arraybuffer' });

            await conn.sendMessage(m.chat, {
                image: Buffer.from(res.data),
                caption: `📸 *Screenshot Captured!*\n🌐 *URL:* ${url}`
            }, { quoted: m });
        } catch (err) {
            console.error(err);
            await m.reply("Screenshot ගැනීමට නොහැකි විය!");
        }
    }
};

