const mongoose = require('mongoose');
const NodeCache = require('node-cache');
const { proto, BufferJSON, initAuthCreds } = require('@whiskeysockets/baileys');

const AuthSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    data: { type: String, required: true }
  },
  { collection: 'auths', versionKey: false }
);

const Auth = mongoose.models.Auth || mongoose.model('Auth', AuthSchema);

// 🟢 Key cache to eliminate 95% of MongoDB queries & speed up handshake
const keyCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

async function useMongoDBAuthState(sessionId) {
  const writeData = async (data, id) => {
    try {
      const serialized = JSON.stringify(data, BufferJSON.replacer);
      keyCache.set(`${sessionId}-${id}`, serialized);
      await Auth.updateOne(
        { _id: `${sessionId}-${id}` },
        { $set: { data: serialized } },
        { upsert: true }
      );
    } catch (err) {
      console.error(`❌ DB Write Error (${id}):`, err.message);
    }
  };

  const readData = async (id) => {
    try {
      const cacheKey = `${sessionId}-${id}`;
      let dataStr = keyCache.get(cacheKey);

      if (!dataStr) {
        const doc = await Auth.findOne({ _id: cacheKey }).lean();
        if (doc && doc.data) {
          dataStr = doc.data;
          keyCache.set(cacheKey, dataStr);
        }
      }

      return dataStr ? JSON.parse(dataStr, BufferJSON.reviver) : null;
    } catch (error) {
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
          const missingIds = [];

          // 1. RAM Cache එකෙන් මුලින්ම කියවීම (Fast path)
          for (const id of ids) {
            const cacheKey = `${sessionId}-${type}-${id}`;
            const cachedVal = keyCache.get(cacheKey);
            if (cachedVal) {
              try {
                let value = JSON.parse(cachedVal, BufferJSON.reviver);
                if (type === 'app-state-sync-key' && value) {
                  value = proto?.Message?.AppStateSyncKeyData ? proto.Message.AppStateSyncKeyData.fromObject(value) : value;
                }
                data[id] = value;
              } catch (e) {
                missingIds.push(id);
              }
            } else {
              missingIds.push(id);
            }
          }

          if (missingIds.length === 0) return data;

          // 2. Cache එකේ නැති keys පමණක් MongoDB එකෙන් එකවර ගැනීම
          try {
            const queryIds = missingIds.map(id => `${sessionId}-${type}-${id}`);
            const records = await Auth.find({ _id: { $in: queryIds } }).lean();
            const recordMap = new Map();

            for (const item of records) {
              const baseId = item._id.replace(`${sessionId}-${type}-`, '');
              recordMap.set(baseId, item.data);
              keyCache.set(item._id, item.data);
            }

            for (const id of missingIds) {
              let value = null;
              if (recordMap.has(id)) {
                try {
                  value = JSON.parse(recordMap.get(id), BufferJSON.reviver);
                  if (type === 'app-state-sync-key' && value) {
                    value = proto?.Message?.AppStateSyncKeyData ? proto.Message.AppStateSyncKeyData.fromObject(value) : value;
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
                const serialized = JSON.stringify(value, BufferJSON.replacer);
                keyCache.set(key, serialized);
                bulkOps.push({
                  updateOne: {
                    filter: { _id: key },
                    update: { $set: { data: serialized } },
                    upsert: true
                  }
                });
              } else {
                keyCache.del(key);
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
        const prefix = `${sessionId}-`;
        await Auth.deleteMany({ _id: { $gte: prefix, $lt: `${sessionId}-\uffff` } });
        keyCache.flushAll();
      } catch (e) {
        console.error('❌ Session delete error:', e.message);
      }
    }
  };
}

module.exports = { useMongoDBAuthState, Auth };

