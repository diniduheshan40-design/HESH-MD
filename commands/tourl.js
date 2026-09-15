const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
    name: "tourl",
    category: "tools",
    desc: "Convert media to a direct URL",
    async run({ conn, m }) {
        try {
            let quoted = m.quoted ? m.quoted : m;
            let mime = (quoted.msg || quoted).mimetype || '';
            if (!mime) return await m.reply("කරුණාකර Photo එකකට හෝ Video එකකට Reply කරන්න!");

            let type = mime.split('/')[0];
            let stream = await downloadContentFromMessage(quoted.msg, type);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            await m.reply("Converting media to URL... ⏳");

            let form = new FormData();
            form.append("fileToUpload", buffer, `file.${mime.split('/')[1]}`);
            form.append("reqtype", "fileupload");

            let res = await axios.post("https://catbox.moe/user/api.php", form, {
                headers: form.getHeaders()
            });

            await m.reply(`*🔗 Direct Media URL:* \n\n${res.data}`);
        } catch (err) {
            console.error(err);
            await m.reply("URL එක හදන්න බැරි වුණා!");
        }
    }
};

