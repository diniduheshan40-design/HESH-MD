// commands/apk.js
const axios = require('axios');

// ⚡ Multi-Engine APK Fetcher (Chamindu + Fast Free Fallbacks)
async function fetchApkDetails(query) {
  const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";

  // 1. Chamindu AN1 API (Primary)
  if (query.includes('an1.com')) {
    try {
      const chamUrl = `https://api.chamindu.site/api/v1/apk/an1/infodl?q=${encodeURIComponent(query)}&api_key=${API_KEY}`;
      const res = await axios.get(chamUrl, { timeout: 6000 });
      if (res.data?.status && !res.data?.detail?.includes('exhausted')) {
        const data = res.data?.data;
        const apkItem = data?.downloads?.find(d => d.direct_link && d.direct_link.endsWith('.apk')) || data?.downloads?.[0];
        if (apkItem?.direct_link) {
          return {
            title: data.title || "Android App",
            fileName: apkItem.name || `${data.title || 'App'}.apk`,
            size: apkItem.name?.match(/\d+(\.\d+)?\s*(Mb|MB|Gb|GB|Kb|KB)/i)?.[0] || 'Unknown',
            downloadUrl: apkItem.direct_link,
            icon: null
          };
        }
      }
    } catch (e) {}
  }

  // 2. Free Engine 1: BK9 APK Mirror (Direct search by App Name or Link)
  try {
    const cleanSearch = query.replace(/https?:\/\/[^\s]+/g, '').trim() || query;
    const res = await axios.get(`https://bk9.fun/download/apk?q=${encodeURIComponent(cleanSearch)}`, { timeout: 10000 });
    if (res.data?.status && res.data?.BK9?.download) {
      return {
        title: res.data.BK9.name || cleanSearch,
        fileName: `${(res.data.BK9.name || 'App').replace(/[^a-zA-Z0-9._-]/g, '_')}.apk`,
        size: res.data.BK9.size || 'Unknown',
        downloadUrl: res.data.BK9.download,
        icon: res.data.BK9.icon || null
      };
    }
  } catch (e) {}

  // 3. Free Engine 2: Siputzx Aptoide Gateway (Fast & Unlimited)
  try {
    const cleanSearch = query.replace(/https?:\/\/[^\s]+/g, '').trim() || query;
    const res = await axios.get(`https://api.siputzx.my.id/api/apk/search?query=${encodeURIComponent(cleanSearch)}`, { timeout: 10000 });
    if (res.data?.status && Array.isArray(res.data?.data) && res.data.data.length > 0) {
      const topApp = res.data.data[0];
      const dlRes = await axios.get(`https://api.siputzx.my.id/api/apk/download?package=${encodeURIComponent(topApp.package || topApp.id)}`, { timeout: 10000 });
      if (dlRes.data?.status && dlRes.data?.data?.url) {
        return {
          title: topApp.name || cleanSearch,
          fileName: `${(topApp.name || 'App').replace(/[^a-zA-Z0-9._-]/g, '_')}.apk`,
          size: dlRes.data.data.size || 'Unknown',
          downloadUrl: dlRes.data.data.url,
          icon: topApp.icon || null
        };
      }
    }
  } catch (e) {}

  throw new Error('APK එක සොයා ගැනීමට හෝ download කරගැනීමට නොහැකි විය. කරුණාකර නිවැරදි App නමක් ලබාදෙන්න.');
}

module.exports = {
  name: 'apk',
  alias: ['an1', 'apkdl', 'app'],
  category: 'download',
  desc: 'Download Android APK files by Name or Link',

  async execute(sock, msg, args, chatJid) {
    const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
    const targetChat = (typeof chatJid === 'string' && chatJid.includes('@')) 
      ? chatJid 
      : (msg.key && msg.key.remoteJid ? msg.key.remoteJid : null);

    if (!targetChat) return;

    const query = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    if (!query) {
      return await sock.sendMessage(targetChat, { 
        text: `*❪ APK DOWNLOADER ❫*\n\n⚠️ *කරුණාකර App එකේ නම හෝ Link එක ලබාදෙන්න!*\n\n📦 *උදාහරණ:*\n• \`.apk WhatsApp\`\n• \`.apk CapCut\`\n• \`.apk https://an1.com/...html\`${DEFAULT_FOOTER}` 
      }, { quoted: msg });
    }

    sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    const statusMsg = await sock.sendMessage(targetChat, {
      text: '⚡ *APK ගොනුව සොයමින් බාගත කරමින් පවතී, කරුණාකර රැඳී සිටින්න...*'
    }, { quoted: msg }).catch(() => null);

    try {
      const apkData = await fetchApkDetails(query);

      const cleanTitle = apkData.title.replace(/[^a-zA-Z0-9._-]/g, ' ');
      const validFileName = apkData.fileName.endsWith('.apk') ? apkData.fileName : `${apkData.fileName}.apk`;

      const captionText = `*📦 𝗔𝗣𝗞 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥 📦*\n\n` +
                          `📌 *Name:* ${cleanTitle}\n` +
                          `📁 *File:* ${validFileName}\n` +
                          `📊 *Size:* ${apkData.size}\n` +
                          `🚀 *Status:* Uploading APK...${DEFAULT_FOOTER}`;

      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }

      // Send APK as Document
      await sock.sendMessage(targetChat, {
        document: { url: apkData.downloadUrl },
        fileName: validFileName,
        mimetype: 'application/vnd.android.package-archive',
        caption: captionText
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('APK DL Error:', err.message);
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
      await sock.sendMessage(targetChat, { 
        text: `❌ *APK Download Error:* ${err.message || 'Server busy'}${DEFAULT_FOOTER}` 
      }, { quoted: msg }).catch(() => {});
    }
  }
};
