module.exports = {
  name: "tagall",
  category: "group",
  desc: "Tag all group members",

  async execute(sock, msg, args, chatJid, safeReply) {
    try {
      const isGroup = chatJid.endsWith('@g.us');
      if (!isGroup) {
        return await safeReply("❌ මේ Command එක Group වල පමණක් පාවිච්චි කළ හැක!");
      }

      // Group Metadata ලබාගැනීම
      const groupMetadata = await sock.groupMetadata(chatJid);
      const participants = groupMetadata.participants || [];
      const customMsg = args.join(" ").trim() || "Attention Everyone! 📢";

      if (participants.length === 0) {
        return await safeReply("❌ සාමාජිකයින් හමු නොවීය!");
      }

      // Fast mapping (Loop lag එක නැති කිරීම සඳහා)
      const mentions = participants.map(p => p.id);
      const memberList = participants.map(p => `│ 👤 @${p.id.split('@')[0]}`).join('\n');

      const text = `╭───「 *TAG ALL ANNOUNCEMENT* 」
│
│ 💬 *Message:* ${customMsg}
│ 👥 *Total Members:* ${participants.length}
│
${memberList}
│
╰─────────────────────
> ⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡`;

      await sock.sendMessage(chatJid, {
        text: text,
        mentions: mentions
      }, { quoted: msg });

    } catch (err) {
      console.error('tagall error:', err.message);
      await safeReply("❌ Group Members ලා Tag කිරීමේදී දෝෂයක් ඇති විය!");
    }
  }
};
