const { delay } = require('@whiskeysockets/baileys');

/**
 * Active bots හරහා Channel Follow Boost කිරීම
 */
async function boostChannelFollow(inviteCode, targetCount) {
  const sessions = Object.values(global.activeSessions || {});
  let successCount = 0;

  for (const sock of sessions) {
    if (successCount >= targetCount) break;

    try {
      if (typeof sock.newsletterMetadata === 'function' && typeof sock.newsletterFollow === 'function') {
        const meta = await sock.newsletterMetadata('invite', inviteCode);
        if (meta?.id) {
          await sock.newsletterFollow(meta.id);
          successCount++;
          await delay(1200); // Flood ban නොවීමට safe delay එකක්
        }
      }
    } catch (e) {
      // Offline/Rate-limit sessions skip කර ඉදිරියට යයි
    }
  }

  return successCount;
}

/**
 * Active bots හරහා Channel Post එකකට Reactions යැවීම
 */
async function boostChannelReact(channelJid, serverId, emoji, targetCount) {
  const sessions = Object.values(global.activeSessions || {});
  let successCount = 0;

  for (const sock of sessions) {
    if (successCount >= targetCount) break;

    try {
      await sock.sendMessage(channelJid, {
        react: {
          text: emoji,
          key: {
            remoteJid: channelJid,
            server_id: serverId,
            fromMe: false
          }
        }
      });
      successCount++;
      await delay(1000);
    } catch (e) {
      // Continue next session
    }
  }

  return successCount;
}

module.exports = {
  boostChannelFollow,
  boostChannelReact
};
