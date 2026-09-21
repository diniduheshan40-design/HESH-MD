// lib/buttonHelper.js
const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

async function sendInteractiveButton(sock, jid, options = {}, quoted = null) {
  const {
    title = '',
    text = '',
    footer = '⚡ ᴘᴏᴡᴇʀᴇᴅ ʙʏ ʜᴇꜱʜᴀɴ-ᴍᴅ ⚡',
    buttons = []
  } = options;

  const formattedButtons = buttons.map((btn, index) => {
    if (btn.type === 'url') {
      return {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: btn.displayText,
          url: btn.url,
          merchant_url: btn.url
        })
      };
    }

    if (btn.type === 'call') {
      return {
        name: 'cta_call',
        buttonParamsJson: JSON.stringify({
          display_text: btn.displayText,
          phone_number: btn.phoneNumber
        })
      };
    }

    return {
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({
        display_text: btn.displayText,
        id: btn.id || `btn_${index}`
      })
    };
  });

  const interactiveMessage = {
    header: {
      title: title,
      hasMediaAttachment: false
    },
    body: { text: text },
    footer: { text: footer },
    nativeFlowMessage: {
      buttons: formattedButtons
    },
    contextInfo: {
      ...(global.channelContext?.contextInfo || {})
    }
  };

  const message = {
    viewOnceMessage: {
      message: {
        interactiveMessage: proto.Message.InteractiveMessage.create(interactiveMessage)
      }
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

