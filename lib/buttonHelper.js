// lib/buttonHelper.js
const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

async function sendInteractiveButton(sock, jid, options = {}, quoted = null) {
  const {
    title = '⚡ HESHAN-MD MENU ⚡',
    text = '',
    footer = '⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡',
    buttonText = '🔘 SELECT OPTION',
    buttons = []
  } = options;

  // Convert buttons to List Rows (100% WhatsApp Support)
  const rows = buttons.map((btn, i) => ({
    title: btn.displayText || `Option ${i + 1}`,
    rowId: btn.id || btn.displayText,
    description: btn.description || ''
  }));

  const sections = [
    {
      title: 'AVAILABLE ACTIONS',
      rows: rows
    }
  ];

  const listMessage = {
    text: text,
    footer: footer,
    title: title,
    buttonText: buttonText,
    sections: sections
  };

  return await sock.sendMessage(jid, listMessage, { quoted });
}

module.exports = { sendInteractiveButton };
