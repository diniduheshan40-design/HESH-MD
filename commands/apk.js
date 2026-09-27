// commands/apk.js
const axios = require('axios');

const API_KEY = "chama_api_ec9848130d1aea209f08fb85e0b4720f";

// ⚡ Multi-Engine APK Fetcher (Chamindu AN-1 Search & DL + Multiple Direct Fallbacks)
async function fetchApkDetails(query) {
  let targetUrl = query.trim();

  // 1. Chamindu AN1 Engine
  try {
    // නමක් දුන්නොත් search කරලා AN1 URL එක ගන්නවා
    if (!targetUrl.startsWith('http')) {
      const searchEndpoint = `https://api.chamindu.site/api/v1/apk/an1/search?q=${encodeURIComponent(targetUrl)}&api_key=${API_KEY}`;
      const searchRes = await axios.get(searchEndpoint, { timeout: 10000 });
      
      if (searchRes.data?.status && Array.isArray(searchRes.data?.data) && searchRes.data.data.length > 0) {
        targetUrl = searchRes.data.data[0].url;
      }
    }

    // URL එක හරහා direct download link එක ලබාගැනීම
    if (targetUrl.includes('an1.com')) {
      const chamDlUrl = `https://api.chamindu.site/api/v1/apk/an1/infodl?q=${encodeURIComponent(targetUrl)}&api_key=${API_KEY}`;
      const dlRes = await axios.get(chamDlUrl, { timeout: 15000 });

      if (dlRes.data?.status && dlRes.data?.data) {
        const item = dlRes.data.data;
        const apkFile = item.downloads?.find(d => d.direct_link && d.direct_link.endsWith('.apk')) || item.downloads?.[0];
        
        if (apkFile?.direct_link) {
          return {
            title: item.title || query,
            fileName: `${(item.title || query).replace(/[^a-zA-Z0-9._-]/g, '_')}.apk`,
            size: apkFile.name?.match(/\d+(\.\d+)?\s*(Mb|MB|Gb|GB|Kb|KB)/i)?.[0] || 'Unknown',
            downloadUrl: apkFile.direct_link,
            icon: item.image || null
          };
        }
      }
    }
  } catch (e) {
    console.error('Chamindu AN1 API Error:', e?.message || e);
  }

  // 2. Free Fallback Engine 1: BK9 API
  try {
    const cleanSearch = query.replace(/https?:\/\/[^\s]+/g, '').trim() || query;
    const res = await axios.get(`https://bk9.fun/download/apk?q=${encodeURIComponent(cleanSearch)}`, { timeout: 12000 });
    if (res.data?.status && res.data?.BK9?.download) {
      return {
        title: res.data.BK9.name || cleanSearch,
        fileName: `${(res.data.BK9.name || cleanSearch).replace(/[^a-zA-Z0-9._-]/g, '_')}.apk`,
        size: res.data.BK9.size || 'Unknown',
        downloadUrl: res.data.BK9.download,
        icon: res.data.BK9.icon || null
      };
    }
  } catch (e) {}

  // 3. Free Fallback Engine 2: Siputzx Aptoide Gateway
  try {
    const cleanSearch = query.replace(/https?:\/\/[^\s]+/g, '').trim() || query;
    const res = await axios.get(`https://api.siputzx.my.id/api/apk/search?query=${encodeURIComponent(cleanSearch)}`, { timeout: 10000 });
    if (res.data?.status && Array.isArray(res.data?.data) && res.data.data.length > 0) {
      const topApp = res.data.data[0];
      const pkg = topApp.package || topApp.id;
      const dlRes = await axios.get(`https://api.siputzx.my.id/api/apk/download?package=${encodeURIComponent(pkg)}`, { timeout: 12000 });
      if (dlRes.data?.status && dlRes.data?.data?.url) {
        return {
          title: topApp.name || cleanSearch,
          fileName: `${(topApp.name || cleanSearch).replace(/[^a-zA-Z0-9._-]/g, '_')}.apk`,
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

  async execute(sock, msg, args, chatJid, safeReply) {
    const DEFAULT_FOOTER = '\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡';
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const query = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim();

    const reply = async (text) => {
      if (typeof safeReply === 'function') return await safeReply(text);
      return await sock.sendMessage(targetChat, { text, ...(global.channelContext || {}) }, { quoted: msg });
    };

    if (!query) {
      return await reply(
        `*❪ APK DOWNLOADER ❫*\n\n⚠️ *කරුණාකර App එකේ නම හෝ Link එක ලබාදෙන්න!*\n\n📦 *උදාහරණ:*\n• \`.apk WhatsApp\`\n• \`.apk CapCut\`\n• \`.apk https://an1.com/...html\`${DEFAULT_FOOTER}`
      );
    }

    sock.sendMessage(targetChat, { react: { text: '⏳', key: msg.key } }).catch(() => {});

    const statusMsg = await sock.sendMessage(targetChat, {
      text: '⚡ *APK ගොනුව සොයමින් බාගත කරමින් පවතී, කරුණාකර රැඳී සිටින්න...*',
      ...(global.channelContext || {})
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

      await sock.sendMessage(targetChat, { react: { text: '⬆️', key: msg.key } }).catch(() => {});

      // Direct Document Dispatch
      await sock.sendMessage(targetChat, {
        document: { url: apkData.downloadUrl },
        fileName: validFileName,
        mimetype: 'application/vnd.android.package-archive',
        caption: captionText,
        ...(global.channelContext || {})
      }, { quoted: msg });

      sock.sendMessage(targetChat, { react: { text: '✅', key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('APK DL Error:', err?.message || err);
      if (statusMsg?.key) {
        sock.sendMessage(targetChat, { delete: statusMsg.key }).catch(() => {});
      }
      sock.sendMessage(targetChat, { react: { text: '❌', key: msg.key } }).catch(() => {});
      await reply(`❌ *APK Download Error:* ${err.message || 'Server busy'}${DEFAULT_FOOTER}`);
    }
  }
};
