const axios = require('axios');
const config = require('./config');

async function askAI(prompt) {
  const apiKey = config.OPENROUTER_KEYS[0];

  if (!apiKey) {
    return "❌ API Key එක සකසා නැත. Render Environment එකේ OPENROUTER_API_KEY සකසන්න.";
  }

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: config.AI_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are ${config.BOT_NAME}, an ultra-fast, intelligent, and friendly WhatsApp AI assistant created by Dinidu Heshan. Always answer helpfully, naturally, and concisely.`
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://render.com',
          'X-Title': config.BOT_NAME
        },
        timeout: 25000
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('AI Error:', error?.response?.data || error.message);
    return '⚡ AI සේවාව හා සම්බන්ධ වීමේදී සුළු දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න.';
  }
}

module.exports = { askAI };
