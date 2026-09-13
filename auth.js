const mongoose = require('mongoose');
const { proto, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

const AuthSchema = new mongoose.Schema({
  _id: String,
  data: String
});

const Auth = mongoose.model('Auth', AuthSchema);

const useMongoDBAuthState = async (sessionId) => {
  const writeData = async (data, key) => {
    try {
      await Auth.findByIdAndUpdate(
        `${sessionId}-${key}`,
        { data: JSON.stringify(data, BufferJSON.replacer) },
        { upsert: true }
      );
    } catch (e) {
      console.error('Database write error:', e);
    }
  };

  const readData = async (key) => {
    try {
      const doc = await Auth.findById(`${sessionId}-${key}`);
      if (!doc || !doc.data) return null;
      return JSON.parse(doc.data, BufferJSON.reviver);
    } catch (e) {
      return null;
    }
  };

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(value, key) : Auth.findByIdAndDelete(`${sessionId}-${key}`));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => writeData(creds, 'creds'),
    clearSessionData: async () => {
      await Auth.deleteMany({ _id: new RegExp(`^${sessionId}-`) });
    }
  };
};

module.exports = { useMongoDBAuthState, Auth };
