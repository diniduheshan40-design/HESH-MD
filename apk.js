const axios = require('axios');

module.exports = {
    name: "apk",
    category: "download",
    desc: "Download Android APK directly",
    async run({ conn, m, args }) {
        let appName = args.join(" ");
        if (!appName) return await m.reply("කරුණාකර App එකේ නම ඇතුළත් කරන්න!\nඋදා: `.apk telegram`");

        try {
            await m.reply(`Searching for *${appName}*... ⏳`);
            
            // Public API හරහා download link එක ගැනීම
            let res = await axios.get(`https://bk9.fun/download/apk?q=${encodeURIComponent(appName)}`);
            let data = res.data;

            if (!data.status || !data.BK9) {
                return await m.reply("අදාළ App එක සොයා ගැනීමට නොහැකි විය!");
            }

            let app = data.BK9;
            await conn.sendMessage(m.chat, {
                document: { url: app.dllink },
                mimetype: 'application/vnd.android.package-archive',
                fileName: `${app.name}.apk`,
                caption: `📦 *Name:* ${app.name}\n🏷️ *Package:* ${app.package}\n⚖️ *Size:* ${app.size}`
            }, { quoted: m });

        } catch (err) {
            console.error(err);
            await m.reply("APK එක බාගත කිරීමේදී දෝෂයක් ඇති විය!");
        }
    }
};

