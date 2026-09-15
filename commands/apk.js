const axios = require('axios');

module.exports = {
    name: 'apk',
    alias: ['liteapks', 'modapk'],
    async execute(sock, msg, args, chatJid) {
        const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';

        if (!args.length) {
            return await sock.sendMessage(chatJid, {
                text: `*❪ ERROR ❫*\n\n⚠️ *Invalid Usage!*\n\n📱 *Example:*\n• .apk spotify\n• .liteapks capcut\n\n📝 _Please provide the App or Game name!_${DEFAULT_FOOTER}`
            }, { quoted: msg });
        }

        const query = args.join(' ').trim();
        const API_BASE = "https://api.chamindu.site";
        const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
        const DEFAULT_IMAGE = "https://api.chamindu.site/logo.png";

        try {
            await sock.sendMessage(chatJid, { react: { text: '⏳', key: msg.key } });

            const res = await axios.get(`${API_BASE}/api/v1/apps/liteapks/search?q=${encodeURIComponent(query)}&api_key=${API_KEY}`, { timeout: 20000 });
            const results = res.data?.data || [];

            if (!results.length) {
                await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
                return await sock.sendMessage(chatJid, {
                    text: `*❪ NO RESULTS ❫*\n\n😞 *No MOD APKs Found for:* _${query}_${DEFAULT_FOOTER}`
                }, { quoted: msg });
            }

            let listText = `*❪ LITEAPKS MOD SEARCH ❫*\n\n🎯 *Query:* _${query}_\n📊 *Total:* _${results.length} Apps_\n\n*👇 SELECT A NUMBER 👇*\n\n`;
            results.slice(0, 15).forEach((item, index) => {
                const num = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
                listText += `*${num}* ➜ 📱 _${(item.title || 'App').substring(0, 32)}_ (${item.version || 'Latest'})\n`;
            });
            listText += `\n📌 _Reply to this message with the number to get APK links!_${DEFAULT_FOOTER}`;

            const sentMsg = await sock.sendMessage(chatJid, { text: listText }, { quoted: msg });
            const messageID = sentMsg.key.id;

            await sock.sendMessage(chatJid, { react: { text: '🔢', key: msg.key } });

            // Reply එක අල්ලා ගැනීම සඳහා listener එකක් සැකසීම
            const handleSelection = async ({ messages: replyMessages }) => {
                const replyMek = replyMessages[0];
                if (!replyMek?.message) return;

                const replyText = replyMek.message.conversation || replyMek.message.extendedTextMessage?.text || '';
                const replyToId = replyMek.message.extendedTextMessage?.contextInfo?.stanzaId;

                if (replyToId === messageID && chatJid === replyMek.key.remoteJid) {
                    const choice = parseInt(replyText.trim()) - 1;

                    if (isNaN(choice) || choice < 0 || choice >= Math.min(results.length, 15)) {
                        await sock.sendMessage(chatJid, { 
                            text: `⚠️ *Invalid choice! Please select a number between 01 and ${Math.min(results.length, 15)}*` 
                        }, { quoted: replyMek });
                        return;
                    }

                    // Listener එක ඉවත් කිරීම
                    sock.ev.off('messages.upsert', handleSelection);
                    clearTimeout(timeoutId);

                    const selectedApp = results[choice];
                    await sock.sendMessage(chatJid, { react: { text: '⏳', key: replyMek.key } });

                    try {
                        const infoRes = await axios.get(`${API_BASE}/api/v1/apps/liteapks/info?url=${encodeURIComponent(selectedApp.link)}&api_key=${API_KEY}`, { timeout: 20000 });
                        const appData = infoRes.data?.data || {};
                        const downloads = appData.downloads || appData.download_links || [];

                        let appText = `*❪ LITEAPKS MOD DETAILS ❫*\n\n📱 *App:* ${appData.title || selectedApp.title}\n🔖 *Version:* ${appData.version || 'Latest'}\n\n*📥 DOWNLOAD LINKS:*\n`;

                        if (downloads.length > 0) {
                            downloads.slice(0, 5).forEach((dl, idx) => {
                                appText += `\n*${idx + 1}. ${dl.name || 'MOD APK'}*\n🔗 ${dl.url || dl.link}\n`;
                            });
                        } else {
                            appText += `\n⚠️ *Download page:* ${selectedApp.link}\n`;
                        }

                        appText += DEFAULT_FOOTER;

                        await sock.sendMessage(chatJid, {
                            image: { url: appData.image || selectedApp.image || DEFAULT_IMAGE },
                            caption: appText
                        }, { quoted: replyMek });

                        await sock.sendMessage(chatJid, { react: { text: '✅', key: replyMek.key } });

                    } catch (infoErr) {
                        console.error('LiteAPKs Info Error:', infoErr.message);
                        await sock.sendMessage(chatJid, { react: { text: '❌', key: replyMek.key } });
                        await sock.sendMessage(chatJid, { 
                            text: `❌ *LiteAPKs Info Error:* ${infoErr.message}${DEFAULT_FOOTER}` 
                        }, { quoted: replyMek });
                    }
                }
            };

            sock.ev.on('messages.upsert', handleSelection);

            // තත්පර 60කින් listener එක ඉබේම අක්‍රිය වීම (Memory leak වැළැක්වීමට)
            const timeoutId = setTimeout(() => {
                sock.ev.off('messages.upsert', handleSelection);
            }, 60000);

        } catch (err) {
            console.error('LiteAPKs Search Error:', err.message);
            await sock.sendMessage(chatJid, { react: { text: '❌', key: msg.key } });
            await sock.sendMessage(chatJid, { 
                text: `❌ *LiteAPKs Error:* ${err.message}${DEFAULT_FOOTER}` 
            }, { quoted: msg });
        }
    }
};

