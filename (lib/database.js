const mongoose = require('mongoose');
const crypto = require('crypto');

const SettingsSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // WhatsApp Number
  botPassword: { type: String, default: null },
  coins: { type: Number, default: 50 }, // අලුතින් connect වෙන අයට Free 50 Coins
  isFirstConnectDone: { type: Boolean, default: false },
  alwaysOnline: { type: String, default: 'off' },
  botLogo: { type: String, default: null }
}, { timestamps: true });

const SettingsModel = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

const settingsCache = new Map();

function clearSettingsCache(num) {
  settingsCache.delete(num);
}

async function getBotSettings(phoneNumber) {
  if (settingsCache.has(phoneNumber)) {
    return settingsCache.get(phoneNumber);
  }

  let settings = await SettingsModel.findById(phoneNumber);
  
  if (!settings) {
    const generatedPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
    settings = await SettingsModel.create({
      _id: phoneNumber,
      botPassword: generatedPassword,
      coins: 50,
      isFirstConnectDone: false
    });
  } else if (!settings.botPassword) {
    settings.botPassword = crypto.randomBytes(4).toString('hex').toUpperCase();
    await settings.save();
  }

  settingsCache.set(phoneNumber, settings);
  return settings;
}

const DEFAULT_BACKUP_LOGO = 'https://i.ibb.co/vzG7Z1h/avatar.png';

module.exports = {
  SettingsModel,
  getBotSettings,
  clearSettingsCache,
  DEFAULT_BACKUP_LOGO
};
