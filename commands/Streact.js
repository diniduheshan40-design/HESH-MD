const { getBotSettings, SettingsModel, clearSettingsCache } = require('../lib/database');
const { cleanDigits } = require('../lib/socket');

module.exports = {
  name: 'statusreact',
  alias: ['autostatus', 'sreact'],
  category: 'owner',
  desc: 'Auto Status Reaction Toggle',

  async execute(sock, msg, args, chatJid, safeReply) {
    const targetChat = chatJid || msg.key?.remoteJid;
    const reply = async (text) => (typeof safeReply === 'function' ? safeReply(text) : sock.sendMessage(targetChat, { text }, { quoted: msg }));

    const myNum = cleanDigits(sock.user?.id || '');
    const settings = await getBotSettings(myNum);

    const mode = (args[0] || '').toLowerCase();
    if (mode === 'on') {
      await SettingsModel.findByIdAndUpdate(myNum, { statusReact: true, autoStatusSeen: true }, { upsert: true });
      clearSettingsCache(myNum);
      return await reply('✅ Auto Status React සක්‍රිය (ON) කරන ලදී.');
    } else if (mode === 'off') {
      await SettingsModel.findByIdAndUpdate(myNum, { statusReact: false }, { upsert: true });
      clearSettingsCache(myNum);
      return await reply('❌ Auto Status React අක්‍රිය (OFF) කරන ලදී.');
    }

    return await reply(`💡 භාවිතය:\n• \`.statusreact on\`\n• \`.statusreact off\`\n\nවත්මන් තත්ත්වය: *${settings.statusReact ? 'ON' : 'OFF'}*`);
  }
};
