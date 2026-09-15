const mongoose = require('mongoose');
const { proto, BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

const AuthSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    data: { type: String, required: true }
  },
  { collection: 'auths' }
);

const Auth = mongoose.models.Auth || mongoose.model('Auth', AuthSchema);

async function useMongoDBAuthState(sessionId) {
  const writeData = async (data, id) => {
    try {
      await Auth.updateOne(
        { _id: `${sessionId}-${id}` },
        { $set: { data: JSON.stringify(data, BufferJSON.replacer) } },
        { upsert: true }
      );
    } catch (err) {
      console.error(`❌ DB Write Error (${id}):`, err.message);
    }
  };

  const readData = async (id) => {
    try {
      const doc = await Auth.findOne({ _id: `${sessionId}-${id}` }).lean();
      return doc && doc.data ? JSON.parse(doc.data, BufferJSON.reviver) : null;
    } catch (error) {
      return null;
    }
  };

  const removeData = async (id) => {
    try {
      await Auth.deleteOne({ _id: `${sessionId}-${id}` });
    } catch (err) {}
  };

  const creds = (await readData('creds')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          const queryIds = ids.map(id => `${sessionId}-${type}-${id}`);

          try {
            // Bulk read with $in for 10x speed boost
            const records = await Auth.find({ _id: { $in: queryIds } }).lean();
            const recordMap = new Map();

            for (const item of records) {
              const baseId = item._id.replace(`${sessionId}-${type}-`, '');
              recordMap.set(baseId, item.data);
            }

            for (const id of ids) {
              let value = null;
              if (recordMap.has(id)) {
                try {
                  value = JSON.parse(recordMap.get(id), BufferJSON.reviver);
                  if (type === 'app-state-sync-key' && value && proto?.Message?.AppStateSyncKeyData) {
                    value = proto.Message.AppStateSyncKeyData.fromObject(value);
                  }
                } catch (e) {}
              }
              data[id] = value;
            }
          } catch (e) {
            console.error(`❌ Key fetch error for ${type}:`, e.message);
          }

          return data;
        },
        set: async (data) => {
          const bulkOps = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${sessionId}-${category}-${id}`;

              if (value) {
                bulkOps.push({
                  updateOne: {
                    filter: { _id: key },
                    update: { $set: { data: JSON.stringify(value, BufferJSON.replacer) } },
                    upsert: true
                  }
                });
              } else {
                bulkOps.push({
                  deleteOne: {
                    filter: { _id: key }
                  }
                });
              }
            }
          }

          if (bulkOps.length > 0) {
            try {
              await Auth.bulkWrite(bulkOps, { ordered: false });
            } catch (err) {
              console.error('❌ BulkWrite DB Error:', err.message);
            }
          }
        }
      }
    },
    saveCreds: () => writeData(creds, 'creds'),
    clearSessionData: async () => {
      try {
        await Auth.deleteMany({ _id: new RegExp(`^${sessionId}-`) });
      } catch (e) {}
    }
  };
}

module.exports = { useMongoDBAuthState, Auth };
