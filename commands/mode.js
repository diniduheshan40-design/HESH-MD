module.exports = {
  name: 'mode',
  category: 'owner',
  desc: 'Change bot operation mode',
  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key.remoteJid;
    const isGroup = targetChat.endsWith('@g.us');
    const sender = isGroup ? (msg.key.participant || '') : targetChat;

    // Bot run වන number එක හෝ Creator number එක owner ලෙස පිළිගැනීම
    const creatorNumber = '94719845166';
    const isOwner = msg.key.fromMe || sender.includes(creatorNumber);

    if (!isOwner) {
      return await sock.sendMessage(targetChat, { 
        text: "⛔ *Access Denied!* Only the bot owner can change settings." 
      }, { quoted: msg });
    }

    const inputMode = args[0]?.toLowerCase();

    if (inputMode === 'public') {
      global.botMode = 'public';
      return await sock.sendMessage(targetChat, { 
        text: "🌐 *BOT MODE UPDATED*\n\nMode: *PUBLIC* 🟢\n> දැන් ඕනෑම කෙනෙකුට බොට් භාවිත කළ හැක.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
      }, { quoted: msg });
    } 
    else if (inputMode === 'private') {
      global.botMode = 'private';
      return await sock.sendMessage(targetChat, { 
        text: "🔒 *BOT MODE UPDATED*\n\nMode: *PRIVATE* 🔴\n> දැන් බොට් ක්‍රියා කරන්නේ Owner ට පමණි.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
      }, { quoted: msg });
    } 
    else if (inputMode === 'group') {
      global.botMode = 'group';
      return await sock.sendMessage(targetChat, { 
        text: "👥 *BOT MODE UPDATED*\n\nMode: *GROUP ONLY* 🟡\n> බොට් ක්‍රියා කරන්නේ Groups තුළ පමණි.\n\n> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡" 
      }, { quoted: msg });
    } 
    else {
      const current = global.botMode || 'public';
      const settingText = `
╭───〔 ⚙️ *BOT SETTINGS PANEL* 〕───╮
│
├▸ *Current Mode:* \`${current.toUpperCase()}\`
│
├─╼〔 *AVAILABLE MODES* 〕
│  ◇ *.mode public* - Open for everyone
│  ◇ *.mode private* - Owner only
│  ◇ *.mode group* - Groups only
│
╰────────────────────────────────╯
> *Usage:* Send \`.mode public\` to switch mode.
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`.trim();

      return await sock.sendMessage(targetChat, { text: settingText }, { quoted: msg });
    }
  }
};
