// lib/buttonHelper.js
const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

async function sendInteractiveButton(sock, jid, options = {}, quoted = null) {
  const {
    title = '⚡ HESHAN-MD ⚡',
    text = '',
    footer = '⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡',
    buttonText = '🔘 SELECT OPTION',
    buttons = []
  } = options;

  const rows = buttons.map((btn, i) => ({
    title: btn.displayText || `Option ${i + 1}`,
    rowId: btn.id || btn.displayText,
    description: btn.description || ''
  }));

  const listMessage = {
    title: title,
    description: text,
    buttonText: buttonText,
    footerText: footer,
    sections: [
      {
        title: 'COMMAND OPTIONS',
        rows: rows
      }
    ],
    listType: 1
  };

  const message = {
    listMessage: proto.Message.ListMessage.create(listMessage),
    contextInfo: {
      ...(global.channelContext?.contextInfo || {})
    }
  };

  const generated = generateWAMessageFromContent(
    jid,
    message,
    { quoted, userJid: sock.user?.id }
  );

  return await sock.relayMessage(jid, generated.message, { messageId: generated.key.id });
}

module.exports = { sendInteractiveButton };
