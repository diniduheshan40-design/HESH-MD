const mongoose = require('mongoose');
const NodeCache = require('node-cache');

const DEFAULT_BACKUP_LOGO = 'https://files.catbox.moe/a58add.jpeg';

const DEFAULT_SETTINGS = {
  workMode: 'public',
  autoStatusSeen: true,
  statusReact: true,
  statusReactEmoji: '💐',
  botLogo: DEFAULT_BACKUP_LOGO,
  autoPresence: 'off',
  alwaysOnline: 'off',
  autoChatRead: false,
  aiChatEnabled: false,
  antiDeleteEnabled: true,
  antiDeleteType: 'all',
  antiDeleteDest: 'me',
  securityPin: '1234',
  isFirstConnectDone: false
};

const settingsCache = new NodeCache({ stdTTL: 300, checkperiod: 60, maxKeys: 300 });

const SettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  workMode: { type: String, default: DEFAULT_SETTINGS.workMode },
  autoStatusSeen: { type: Boolean, default: DEFAULT_SETTINGS.autoStatusSeen },
  statusReact: { type: Boolean, default: DEFAULT_SETTINGS.statusReact },
  statusReactEmoji: { type: String, default: DEFAULT_SETTINGS.statusReactEmoji },
  botLogo: { type: String, default: DEFAULT_SETTINGS.botLogo },
  autoPresence: { type: String, default: DEFAULT_SETTINGS.autoPresence },
  alwaysOnline: { type: String, default: DEFAULT_SETTINGS.alwaysOnline },
  autoChatRead: { type: Boolean, default: DEFAULT_SETTINGS.autoChatRead },
  aiChatEnabled: { type: Boolean, default: DEFAULT_SETTINGS.aiChatEnabled },
  antiDeleteEnabled: { type: Boolean, default: DEFAULT_SETTINGS.antiDeleteEnabled },
  antiDeleteType: { type: String, default: DEFAULT_SETTINGS.antiDeleteType },
  antiDeleteDest: { type: String, default: DEFAULT_SETTINGS.antiDeleteDest },
  securityPin: { type: String, default: DEFAULT_SETTINGS.securityPin },
  isFirstConnectDone: { type: Boolean, default: DEFAULT_SETTINGS.isFirstConnectDone }
});

const SettingsModel = mongoose.models.BotSettings || mongoose.model('BotSettings', SettingsSchema);

function clearSettingsCache(num) {
  if (num) {
    const clean = num.replace(/\D/g, '');
    settingsCache.del(clean);
  }
}
global.clearSettingsCache = clearSettingsCache;

async function getBotSettings(botNum) {
  if (!botNum) return { ...DEFAULT_SETTINGS };
  const cleanNum = botNum.replace(/\D/g, '');
  const cached = settingsCache.get(cleanNum);
  if (cached) return cached;

  try {
    let settings = await SettingsModel.findById(cleanNum).lean();
    if (!settings) {
      const created = await SettingsModel.create({ _id: cleanNum, ...DEFAULT_SETTINGS });
      settings = created.toObject();
    }
    settingsCache.set(cleanNum, settings);
    return settings;
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

module.exports = {
  SettingsModel,
  DEFAULT_SETTINGS,
  clearSettingsCache,
  getBotSettings,
  DEFAULT_BACKUP_LOGO
};
