const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');
const axios = require('axios');
const { delay, downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');

const { getBotSettings, clearSettingsCache, DEFAULT_BACKUP_LOGO } = require('./database');
const { cleanDigits } = require('./socket');

const UPDATE_CHANNEL_JID = '120363421906774107@newsletter';
const BOT_CHANNEL_NAME = '✗ ʜᴇꜱʜᴀɴ ᴏꜰᴄ ✨';
const CHANNEL_REACTIONS = ['🥰', '👍', '❤️', '😗', '😯', '🪄', '✨'];

const channelContext = {
  contextInfo: {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: UPDATE_CHANNEL_JID,
      newsletterName: BOT_CHANNEL_NAME,
      serverMessageId: 1
    }
  }
};
global.channelContext = channelContext;
global.songSessions = global.songSessions || new Map();

// 👑 Developers & Owners (Phone + LID Support)
const DEVELOPER_NUMBERS = ['94719845166', '15947733680169'];
const OWNER_NUMBERS = ['94719845166', '94720882316', '15947733680169', '72787431583987'];
global.owner = OWNER_NUMBERS;

const commands = new Map();
const messageVault = new NodeCache({ stdTTL: 86400, checkperiod: 600, maxKeys: 3000 });

function registerCommandAliases(cmd, cmdName) {
  if (cmd && cmd.name) commands.set(cmd.name.toLowerCase(), cmd);
  commands.set(cmdName, cmd);

  if (cmd && cmd.alias) {
    if (Array.isArray(cmd.alias)) {
      for (const al of cmd.alias) commands.set(al.toLowerCase(), cmd);
    } else if (typeof cmd.alias === 'string') {
      commands.set(cmd.alias.toLowerCase(), cmd);
    }
  }
}

function loadAllCommands() {
  const cmdDir = path.join(__dirname, '..', 'commands');
  if (!fs.existsSync(cmdDir)) return;
  const cmdFiles = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));
  for (const file of cmdFiles) {
    try {
      delete require.cache[require.resolve(path.join(cmdDir, file))];
      let cmd = require(path.join(cmdDir, file));
      if (cmd.default) cmd = cmd.default;
      const cmdName = file.replace('.js', '').toLowerCase();
      registerCommandAliases(cmd, cmdName);
    } catch (e) {
      console.error(`❌ Error loading ${file}:`, e.message);
    }
  }
  console.log(`📦 Loaded ${commands.size} commands & aliases.`);
}

function findCommand(...names) {
  for (const name of names) {
    const cmd = commands.get(name);
    if (cmd) return cmd;
  }
  return null;
}

function getCommandExecutor(cmd) {
  if (typeof cmd === 'function') return cmd;
  if (cmd && typeof cmd.execute === 'function') return cmd.execute;
  if (cmd && typeof cmd.run === 'function') return cmd.run;
  if (cmd && typeof cmd.downloadAndSendStatus === 'function') return cmd.downloadAndSendStatus;
  return null;
}

async function reactToChannelPost(sock, msg, chatJid) {
  try {
    const randomEmoji = CHANNEL_REACTIONS[Math.floor(Math.random() * CHANNEL_REACTIONS.length)];
    await delay(1500);
    const serverId = msg.message?.newsletterAdminInviteMessage?.newsletterJid || msg.key?.server_id || msg.key?.id;
    if (typeof sock.newsletterReactMessage === 'function' && serverId) {
      await sock.newsletterReactMessage(chatJid, serverId, randomEmoji);
    } else {
      await sock.sendMessage(chatJid, { react: { text: randomEmoji, key: msg.key } });
    }
  } catch (err) {}
}

async function simulateAutoPresence(sock, chatJid, settings) {
  if (!settings.autoPresence || settings.autoPresence === 'off') return;
  try {
    const type = settings.autoPresence === 'recording' ? 'recording' : 'composing';
    await sock.sendPresenceUpdate(type, chatJid);
  } catch (err) {}
}

async function handleStatusBroadcast(sock, msg, settings) {
  if (!settings.autoStatusSeen) return;
  try {
    await sock.readMessages([msg.key]);
    if (settings.statusReact && msg.key.participant) {
      let emoji = settings.statusReactEmoji || '💚';
      if (emoji === 'random') {
        emoji = CHANNEL_REACTIONS[Math.floor(Math.random() * CHANNEL_REACTIONS.length)];
      }
      await sock.sendMessage(
        'status@broadcast',
        { react: { text: emoji, key: msg.key } },
        { statusJidList: [msg.key.participant] }
      );
    }
  } catch (e) {}
}

function isOwnerJid(jid) {
  if (!jid) return false;
  const num = cleanDigits(jid);
  return OWNER_NUMBERS.some(owner => num === cleanDigits(owner) || String(jid).includes(owner));
}

function checkIsAuthorizedToControl(isOwner, msg, myBotNum, cleanSenderNum) {
  return isOwner || msg.key.fromMe || (Boolean(myBotNum) && cleanSenderNum === myBotNum) || DEVELOPER_NUMBERS.includes(cleanSenderNum);
}

function shouldSkipDueToWorkMode(isAuthorized, isGroup, workMode, cleanSenderNum) {
  if (DEVELOPER_NUMBERS.includes(cleanSenderNum)) return false;
  if (isAuthorized) return false;

  const mode = String(workMode || 'public').toLowerCase().trim();
  if (mode === 'public') return false;
  if (mode === 'private' || mode === 'self') return true;
  if ((mode === 'groups' || mode === 'group') && !isGroup) return true;
  if (mode === 'inbox' && isGroup) return true;
  return false;
}

function unwrapMessageContent(message) {
  if (!message) return null;
  return (
    message?.ephemeralMessage?.message ||
    message?.viewOnceMessage?.message ||
    message?.viewOnceMessageV2?.message ||
    message?.viewOnceMessageV2Extension?.message ||
    message?.documentWithCaptionMessage?.message ||
    message
  );
}

function extractMessageText(rawMsg) {
  return (
    rawMsg?.conversation ||
    rawMsg?.extendedTextMessage?.text ||
    rawMsg?.imageMessage?.caption ||
    rawMsg?.videoMessage?.caption ||
    rawMsg?.buttonsResponseMessage?.selectedButtonId ||
    rawMsg?.templateButtonReplyMessage?.selectedId ||
    rawMsg?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  ).trim();
}

function extractQuotedText(rawMsg) {
  const ctx = rawMsg?.extendedTextMessage?.contextInfo?.quotedMessage || 
              rawMsg?.contextInfo?.quotedMessage;
  if (!ctx) return '';
  const inner = unwrapMessageContent(ctx);
  return (
    inner?.conversation ||
    inner?.extendedTextMessage?.text ||
    inner?.imageMessage?.caption ||
    inner?.videoMessage?.caption ||
    ''
  );
}

function extractQuotedStanzaId(rawMsg) {
  return rawMsg?.extendedTextMessage?.contextInfo?.stanzaId || 
         rawMsg?.contextInfo?.stanzaId || 
         null;
}

function buildSafeReply(sock, chatJid, msg) {
  return async (content) => {
    let replyPayload = typeof content === 'string' ? { text: content } : { ...content };
    replyPayload.contextInfo = {
      ...(replyPayload.contextInfo || {}),
      ...(global.channelContext?.contextInfo || {})
    };
    try {
      return await sock.sendMessage(chatJid, replyPayload, { quoted: msg });
    } catch (e) {
      return await sock.sendMessage(chatJid, replyPayload);
    }
  };
}

function isQuotedFromSettingsMenu(quotedCaption) {
  return (
    quotedCaption.includes('HESHAN-MD SYSTEM SETTINGS') ||
    quotedCaption.includes('SYSTEM SETTINGS') ||
    quotedCaption.includes('WORK MODE') ||
    quotedCaption.includes('FAKE ACTION') ||
    quotedCaption.includes('ANTI-DELETE')
  );
}

function isQuotedFromMainMenu(quotedCaption) {
  return (
    quotedCaption.includes('COMMAND CATEGORIES') ||
    quotedCaption.includes('DOWNLOAD MENU') ||
    (quotedCaption.includes('USER PROFILE') && quotedCaption.includes('Prefix'))
  );
}

async function handleAntiDelete(sock, deletedMsgKey, botNum) {
  try {
    const settings = await getBotSettings(botNum);
    if (!settings.antiDeleteEnabled) return;

    const msgId = deletedMsgKey?.id;
    if (!msgId) return;

    const saved = messageVault.get(msgId);
    if (!saved || !saved.message) return;

    const isGroup = saved.chatJid.endsWith('@g.us');
    const scope = settings.antiDeleteType || 'all';

    if (scope === 'inbox' && isGroup) return;
    if (scope === 'group' && !isGroup) return;

    const targetDest = settings.antiDeleteDest === 'from' ? saved.chatJid : `${botNum}@s.whatsapp.net`;
    const sender = saved.sender.split('@')[0];
    const timeStr = new Date(saved.timestamp * 1000).toLocaleTimeString();

    const banner = `🛡️ *[ ANTI-DELETE DETECTED ]* 🛡️\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `• *From*   : @${sender}\n` +
      `• *Chat*   : ${isGroup ? 'Group' : 'Inbox'}\n` +
      `• *Time*   : ${timeStr}\n` +
      `━━━━━━━━━━━━━━━━━━━━━`;

    const raw = unwrapMessageContent(saved.message);

    if (raw.conversation || raw.extendedTextMessage) {
      const text = raw.conversation || raw.extendedTextMessage.text;
      await sock.sendMessage(targetDest, {
        text: `${banner}\n\n*Deleted Message :*\n${text}`,
        mentions: [saved.sender],
        ...global.channelContext
      });
    } else if (raw.imageMessage) {
      const stream = await downloadContentFromMessage(raw.imageMessage, 'image');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await sock.sendMessage(targetDest, {
        image: buffer,
        caption: `${banner}\n\n*Caption :* ${raw.imageMessage.caption || 'None'}`,
        mentions: [saved.sender],
        ...global.channelContext
      });
    } else if (raw.videoMessage) {
      const stream = await downloadContentFromMessage(raw.videoMessage, 'video');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await sock.sendMessage(targetDest, {
        video: buffer,
        caption: `${banner}\n\n*Caption :* ${raw.videoMessage.caption || 'None'}`,
        mentions: [saved.sender],
        ...global.channelContext
      });
    } else if (raw.audioMessage) {
      const stream = await downloadContentFromMessage(raw.audioMessage, 'audio');
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await sock.sendMessage(targetDest, {
        audio: buffer,
        mimetype: raw.audioMessage.mimetype || 'audio/mp4',
        ptt: Boolean(raw.audioMessage.ptt)
      });
    }
  } catch (err) {
    console.error('Anti-Delete Execution Error:', err.message);
  }
}

async function handlePrefixCommand(sock, msg, text, chatJid, safeReply, isAuthorized, isGroup, isOwner, currentMode, myBotNum, cleanSenderNum) {
  const prefixMatch = text.match(/^[./!#]/);
  if (!prefixMatch) return false;

  const prefix = prefixMatch[0];
  const args = text.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const isSettingsCmd = ['setting', 'settings', 'set', 'config'].includes(commandName);

  if (isSettingsCmd && !isAuthorized && !DEVELOPER_NUMBERS.includes(cleanSenderNum)) {
    await safeReply('⚠️ Settings වෙනස් කළ හැක්කේ Bot හිමිකරුට (Owner) පමණි.');
    return true;
  }

  if (shouldSkipDueToWorkMode(isAuthorized, isGroup, currentMode, cleanSenderNum)) {
    return true;
  }

  let targetCmd = commands.get(commandName);
  if (!targetCmd && isSettingsCmd) targetCmd = findCommand('settings', 'setting', 'set');
  if (!targetCmd) return false;

  try {
    const cmdFunc = getCommandExecutor(targetCmd);
    if (cmdFunc) {
      await cmdFunc(sock, msg, args, chatJid, safeReply, { isOwner: (isAuthorized || DEVELOPER_NUMBERS.includes(cleanSenderNum)), isGroup });
      if (isSettingsCmd) clearSettingsCache(myBotNum);
    }
  } catch (err) {
    console.error(`Command [${commandName}] execution error:`, err?.message);
  }
  return true;
}

// Helper: YouTube Audio Stream Fetcher
async function fetchAudioStreamBuffer(videoUrl) {
  const targetUrl = encodeURIComponent(videoUrl);

  // 🥇 Primary: Supun OFC YTMP3 API
  try {
    const supunApiUrl = `https://supunofc.site/api/download/ytmp3-down?url=${targetUrl}&apikey=supun-tvo5olfxylo98b8l6b9lq174`;
    const res = await axios.get(supunApiUrl, { timeout: 25000 });

    if (res.data?.success && res.data?.result) {
      let audioList = [];
      if (Array.isArray(res.data.result)) {
        audioList = res.data.result;
      } else if (Array.isArray(res.data.result.audioStreams)) {
        audioList = res.data.result.audioStreams;
      }

      const dlUrl = audioList[0]?.downloadUrl;
      if (dlUrl) {
        const audioRes = await axios.get(dlUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.youtube.com/'
          }
        });
        const title = res.data.result?.title || res.data.query || 'Song';
        return { buffer: Buffer.from(audioRes.data), title };
      }
    }
  } catch (e) {}

  // 🥈 Backup 1: Chamindu API
  try {
    const apiKey = 'chama_api_ec9848130d1aea209f08fb85e0b4720f';
    const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${targetUrl}&quality=320kbps&format=mp3&api_key=${apiKey}`;
    const res = await axios.get(apiUrl, { timeout: 20000 });
    const dlUrl = res.data?.download_url || res.data?.direct_url || res.data?.data?.download_url;
    if (dlUrl) {
      const streamRes = await axios.get(dlUrl, {
        responseType: 'arraybuffer',
        timeout: 45000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      return { buffer: Buffer.from(streamRes.data), title: res.data?.title || 'Song' };
    }
  } catch (e) {}

  // 🥉 Backup 2: Gifted API
  try {
    const res = await axios.get(`https://api.giftedtech.web.id/api/download/ytmp3?apikey=gifted&url=${targetUrl}`, { timeout: 15000 });
    const dl = res.data?.result?.download_url || res.data?.download_url;
    if (dl) {
      const audio = await axios.get(dl, { responseType: 'arraybuffer', timeout: 45000 });
      return { buffer: Buffer.from(audio.data), title: res.data?.result?.title || 'Song' };
    }
  } catch (e) {}

  throw new Error('All download servers are busy. Please try again!');
}

async function processSingleMessage(sock, msg, phoneNumber) {
  if (!msg || !msg.message) return;
  const chatJid = msg.key?.remoteJid;
  if (!chatJid) return;

  const isGroup = chatJid.endsWith('@g.us');
  const myBotJid = jidNormalizedUser(sock.user?.id || '');
  const myBotNum = cleanDigits(myBotJid) || cleanDigits(phoneNumber);

  const rawMsg = unwrapMessageContent(msg.message);

  // Save to Anti-Delete Vault
  if (msg.key?.id && !msg.key.fromMe && chatJid !== 'status@broadcast') {
    const sender = isGroup ? (msg.key?.participant || msg.participant || '') : chatJid;
    messageVault.set(msg.key.id, {
      chatJid,
      sender,
      message: msg.message,
      timestamp: msg.messageTimestamp || Math.floor(Date.now() / 1000)
    });
  }

  // Handle Revoke
  if (rawMsg?.protocolMessage?.type === 0 || rawMsg?.protocolMessage?.type === 'REVOKE') {
    await handleAntiDelete(sock, rawMsg.protocolMessage.key, myBotNum);
    return;
  }

  const text = extractMessageText(rawMsg);
  if (!text || msg.message.reactionMessage) return;

  const cleanInput = text.toLowerCase().trim();
  const quotedText = extractQuotedText(rawMsg);
  const quotedMsgId = extractQuotedStanzaId(rawMsg);

  const isNumericSelection = ['1', '2', '3'].includes(cleanInput);
  const isPrefixCommand = /^[./!#]/.test(text.trim());

  if (msg.key.fromMe && !isPrefixCommand && !isNumericSelection) return;

  const isChannel = chatJid === UPDATE_CHANNEL_JID || chatJid.endsWith('@newsletter');
  if (isChannel) reactToChannelPost(sock, msg, chatJid);

  const settings = await getBotSettings(myBotNum);

  if (!isChannel) {
    if (settings.autoChatRead && !msg.key.fromMe) sock.readMessages([msg.key]).catch(() => {});
    if (!msg.key.fromMe) simulateAutoPresence(sock, chatJid, settings);
  }

  if (chatJid === 'status@broadcast') {
    await handleStatusBroadcast(sock, msg, settings);
    return;
  }

  let originalSender = isGroup ? (msg.key?.participant || msg.participant || '') : chatJid;
  if (originalSender.endsWith('@lid') && sock.signalRepository?.lidToJid) {
    try {
      const resolved = await sock.signalRepository.lidToJid(originalSender);
      if (resolved) originalSender = resolved;
    } catch (e) {}
  }

  const cleanSenderNum = cleanDigits(originalSender);
  const isOwner = isOwnerJid(originalSender) || isOwnerJid(cleanSenderNum);
  const isAuthorized = checkIsAuthorizedToControl(isOwner, msg, myBotNum, cleanSenderNum);
  const currentMode = settings.workMode || 'public';
  const safeReply = buildSafeReply(sock, chatJid, msg);

  // 🎵 Interactive Song Reply Handler
  const isSongCard = quotedText.includes('TRACK INFO') || 
                     quotedText.includes('SELECT FORMAT') || 
                     quotedText.includes('HESHAN AUDIO BEATS') ||
                     quotedText.includes('AUDIO (MP3)') ||
                     quotedText.includes('Audio (MP3)');

  const hasSongSession = isSongCard || 
                         (quotedMsgId && global.songSessions?.has(quotedMsgId)) || 
                         global.songSessions?.has(chatJid);

  if ((isSongCard || hasSongSession) && isNumericSelection) {
    const session = (quotedMsgId && global.songSessions?.get(quotedMsgId)) || global.songSessions?.get(chatJid);

    if (session && session.videoUrl) {
      if (quotedMsgId) global.songSessions.delete(quotedMsgId);
      global.songSessions.delete(chatJid);

      await sock.sendMessage(chatJid, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      try {
        const { buffer, title } = await fetchAudioStreamBuffer(session.videoUrl);
        const songTitle = session.title || title || 'Song';

        await sock.sendMessage(chatJid, { react: { text: "⬆️", key: msg.key } }).catch(() => {});

        if (cleanInput === '1') {
          await sock.sendMessage(chatJid, {
            audio: buffer,
            mimetype: 'audio/mp4',
            fileName: `${songTitle}.mp3`,
            ptt: false,
            contextInfo: {
              externalAdReply: {
                title: songTitle,
                body: 'HESHAN-MD AUDIO ENGINE',
                thumbnailUrl: session.thumb || DEFAULT_BACKUP_LOGO,
                sourceUrl: session.videoUrl,
                mediaType: 2,
                renderLargerThumbnail: true
              }
            }
          }, { quoted: msg });
        } else if (cleanInput === '2') {
          await sock.sendMessage(chatJid, {
            document: buffer,
            mimetype: 'audio/mpeg',
            fileName: `${songTitle}.mp3`,
            contextInfo: global.channelContext?.contextInfo
          }, { quoted: msg });
        } else if (cleanInput === '3') {
          await sock.sendMessage(chatJid, {
            audio: buffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
          }, { quoted: msg });
        }

        await sock.sendMessage(chatJid, { react: { text: "✅", key: msg.key } }).catch(() => {});
        return;
      } catch (e) {
        await sock.sendMessage(chatJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
        await safeReply(`❌ *ගීතය ලබාගැනීමේදී දෝෂයක් මතු විය!* (${e?.message || 'Server Timeout'})`);
        return;
      }
    }
  }

  // ViewOnce Quick Emoji Save
  const TRIGGER_EMOJIS = ['❤️', '🥺', '😚', '🌚', '😼', '😂', '🫡', '🥱', '🙌', '🖤', '👍', '🤣', '🥰', '🫢', '🤭', '🫣', 'vv'];
  const quotedMsgObj = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

  if (quotedMsgObj && TRIGGER_EMOJIS.includes(cleanInput)) {
    const saveCmd = findCommand('save', 'vv');
    if (saveCmd) {
      const cmdFunc = getCommandExecutor(saveCmd);
      if (cmdFunc) {
        await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: (isAuthorized || DEVELOPER_NUMBERS.includes(cleanSenderNum)), isGroup });
        return;
      }
    }
  }

  // Main Menu Numbers
  const fromMainMenu = isQuotedFromMainMenu(quotedText);
  if (quotedMsgObj && fromMainMenu && ['1', '2', '3', '4'].includes(cleanInput)) {
    if (!shouldSkipDueToWorkMode(isAuthorized, isGroup, currentMode, cleanSenderNum)) {
      const menuCmd = findCommand('menu', 'help', 'list');
      if (menuCmd) {
        const cmdFunc = getCommandExecutor(menuCmd);
        if (cmdFunc) {
          await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: (isAuthorized || DEVELOPER_NUMBERS.includes(cleanSenderNum)), isGroup });
          return;
        }
      }
    }
  }

  // Settings
  const fromSettingsMenu = isQuotedFromSettingsMenu(quotedText);
  const isDirectSettingsCmd = cleanInput.startsWith('set ') || 
                              cleanInput.startsWith('pin ') || 
                              cleanInput.startsWith('antisend ') || 
                              cleanInput.startsWith('antidel ') ||
                              /^([1-9]|1[0-2])\.[1-4]$/.test(cleanInput);

  if ((isAuthorized || DEVELOPER_NUMBERS.includes(cleanSenderNum)) && !isSongCard && (fromSettingsMenu || isDirectSettingsCmd) && !fromMainMenu) {
    const settingsCmd = findCommand('settings', 'setting', 'set');
    if (settingsCmd) {
      const cmdFunc = getCommandExecutor(settingsCmd);
      if (cmdFunc) {
        await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: true });
        clearSettingsCache(myBotNum);
        return;
      }
    }
  }

  // Status Download
  const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
  const isQuotedFromStatus = quotedContext?.remoteJid === 'status@broadcast' || quotedContext?.participant?.includes('@broadcast');

  if (quotedMsgObj && (isQuotedFromStatus || ['oni', 'ඕනි', 'save', 'status'].includes(cleanInput))) {
    const statusCmd = findCommand('save', 'status');
    if (statusCmd) {
      const cmdFunc = getCommandExecutor(statusCmd);
      if (cmdFunc) {
        await cmdFunc(sock, msg, [cleanInput], chatJid, safeReply, { isOwner: (isAuthorized || DEVELOPER_NUMBERS.includes(cleanSenderNum)) });
        return;
      }
    }
  }

  await handlePrefixCommand(sock, msg, text, chatJid, safeReply, isAuthorized, isGroup, isOwner, currentMode, myBotNum, cleanSenderNum);
}

module.exports = {
  loadAllCommands,
  processSingleMessage
};
