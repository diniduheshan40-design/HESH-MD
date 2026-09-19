// commands/ownertools.js
const util = require('util');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'ownertools',
  alias: ['eval', 'bc', 'broadcast', 'block', 'unblock', 'join', 'leave', 'setpp', 'restart'],
  category: 'owner',
  description: 'Master Owner Control Suite',

  async execute(sock, msg, args, chatJid, safeReply, options = {}) {
    const isOwner = options.isOwner;
    if (!isOwner) {
      return await safeReply('⛔ *Access Denied!* This control suite is reserved for the Master Owner.');
    }

    const targetChat = chatJid || msg.key.remoteJid;
    const rawMsg = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || 
                   msg.message?.imageMessage?.caption || 
                   '';
    const usedCmd = rawMsg.slice(1).trim().split(/ +/)[0].toLowerCase();

    // 🟢 1. JAVASCRIPT EVAL (.eval / >)
    if (usedCmd === 'eval' || usedCmd === '>') {
      const code = args.join(' ');
      if (!code) return await safeReply('⚠️ කරුණාකර execute කිරීමට JS code එක ලබාදෙන්න.');
      
      try {
        let result = await eval(code);
        if (typeof result !== 'string') {
          result = util.inspect(result, { depth: 1 });
        }
        return await safeReply(`💻 *EVAL OUTPUT:*\n\`\`\`javascript\n${result}\n\`\`\``);
      } catch (err) {
        return await safeReply(`❌ *EVAL ERROR:*\n\`\`\`bash\n${err.message}\n\`\`\``);
      }
    }

    // 🟢 2. BROADCAST (.bc <text>)
    if (usedCmd === 'bc' || usedCmd === 'broadcast') {
      const text = args.join(' ');
      if (!text) return await safeReply('⚠️ Broadcast කිරීමට පණිවිඩයක් ලබාදෙන්න.');

      const bcMsg = `*⚡ HESHAN-MD OFFICIAL BROADCAST ⚡*\n────────────────────────────\n${text}\n────────────────────────────\n> 👑 ꜱᴇɴᴛ ʙʏ ᴍᴀꜱᴛᴇʀ ᴏᴡɴᴇʀ`;

      // Active sessions වල chats target කිරීම
      const chats = Object.keys(sock.chats || {});
      await safeReply(`📢 Broadcasting started in background...`);

      // ⚡ Non-blocking background worker
      setImmediate(async () => {
        let count = 0;
        for (const id of chats) {
          try {
            if (!id.includes('broadcast') && (id.endsWith('@s.whatsapp.net') || id.endsWith('@g.us'))) {
              await sock.sendMessage(id, { text: bcMsg }).catch(() => {});
              count++;
              await new Promise(res => setTimeout(res, 500));
            }
          } catch (e) {}
        }
        await sock.sendMessage(targetChat, { text: `✅ Broadcast successfully delivered to *${count}* chats!` }).catch(() => {});
      });
      return;
    }

    // 🟢 3. BLOCK USER (.block)
    if (usedCmd === 'block') {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      let target = contextInfo?.participant || 
                   (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : '');

      if (!target || target === '@s.whatsapp.net') {
        return await safeReply('⚠️ කරුණාකර user කෙනෙක්ගේ මැසේජ් එකකට reply කරන්න හෝ number එක දෙන්න.');
      }

      if (target.endsWith('@lid') && sock.signalRepository?.lidToJid) {
        try { target = await sock.signalRepository.lidToJid(target) || target; } catch(e){}
      }

      try {
        await sock.updateBlockStatus(target, 'block');
        return await safeReply(`🚫 Successfully blocked: @${target.split('@')[0]}`, { mentions: [target] });
      } catch (e) {
        return await safeReply(`❌ Block failed: ${e.message}`);
      }
    }

    // 🟢 4. UNBLOCK USER (.unblock)
    if (usedCmd === 'unblock') {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      let target = contextInfo?.participant || 
                   (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : '');

      if (!target || target === '@s.whatsapp.net') {
        return await safeReply('⚠️ කරුණාකර user කෙනෙක්ගේ මැසේජ් එකකට reply කරන්න හෝ number එක දෙන්න.');
      }

      if (target.endsWith('@lid') && sock.signalRepository?.lidToJid) {
        try { target = await sock.signalRepository.lidToJid(target) || target; } catch(e){}
      }

      try {
        await sock.updateBlockStatus(target, 'unblock');
        return await safeReply(`✅ Successfully unblocked: @${target.split('@')[0]}`, { mentions: [target] });
      } catch (e) {
        return await safeReply(`❌ Unblock failed: ${e.message}`);
      }
    }

    // 🟢 5. JOIN GROUP VIA LINK (.join <link>)
    if (usedCmd === 'join') {
      const link = args[0];
      if (!link || !link.includes('chat.whatsapp.com')) {
        return await safeReply('⚠️ වලංගු WhatsApp Group Invite link එකක් ලබාදෙන්න.');
      }
      const code = link.split('chat.whatsapp.com/')[1]?.trim();
      try {
        await sock.groupAcceptInvite(code);
        return await safeReply('✅ Successfully joined group!');
      } catch (e) {
        return await safeReply(`❌ Failed to join: ${e.message}`);
      }
    }

    // 🟢 6. LEAVE GROUP (.leave)
    if (usedCmd === 'leave') {
      if (!targetChat.endsWith('@g.us')) {
        return await safeReply('⚠️ මේ command එක groups වල පමණක් භාවිතා කරන්න.');
      }
      await safeReply('👋 Goodbye! Master requested me to leave.');
      return await sock.groupLeave(targetChat);
    }

    // 🟢 7. PROFILE PICTURE (.setpp)
    if (usedCmd === 'setpp') {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const isImg = quoted?.imageMessage;
      if (!isImg) {
        return await safeReply('⚠️ කරුණාකර Profile Picture එකට දැමීමට image එකකට reply කර `.setpp` යොදන්න.');
      }
      try {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        const botJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';
        await sock.updateProfilePicture(botJid, buffer);
        return await safeReply('✅ Profile picture successfully updated!');
      } catch (e) {
        return await safeReply(`❌ Failed to update profile picture: ${e.message}`);
      }
    }

    // 🟢 8. RESTART (.restart)
    if (usedCmd === 'restart') {
      await safeReply('🔄 *Restarting Bot Engine...* Please wait a few seconds.');
      setTimeout(() => {
        try { sock.ws?.close(); } catch(e){}
        process.exit(0);
      }, 1000);
      return;
    }

    // DEFAULT MENU (.ownertools)
    const ownerMenu = `
╔══════════════════════════════════════╗
║     👑 MASTER OWNER CONTROL SUITE    ║
╠══════════════════════════════════════╣
║                                      ║
║  ⚙️ *.eval <code>*                    ║
║     └ Execute live JavaScript        ║
║                                      ║
║  📢 *.bc <text>*                     ║
║     └ Broadcast message to all chats ║
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
║     └ Leave the current group        ║
║                                      ║
║  🖼️ *.setpp* (Reply image)           ║
║     └ Update Bot Profile Picture     ║
║                                      ║
║  🔄 *.restart*                       ║
║     └ Restart the server process     ║
║                                      ║
╚══════════════════════════════════════╝
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

    return await safeReply(ownerMenu);
  }
};

