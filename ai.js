const axios = require('axios');
const config = require('./config');

async function askAI(prompt) {
  // Key එක Array එකක් වුවත් String එකක් වුවත් නිවැරදිව ලබා ගැනීම
  let keys = [];
  if (Array.isArray(config.OPENROUTER_KEYS)) {
    keys = config.OPENROUTER_KEYS;
  } else if (typeof config.OPENROUTER_KEYS === 'string') {
    keys = config.OPENROUTER_KEYS.split(',').map(k => k.trim());
  } else if (process.env.OPENROUTER_API_KEY) {
    keys = [process.env.OPENROUTER_API_KEY.trim()];
  }

  const apiKey = keys[0];

  if (!apiKey) {
    return "❌ API Key එක සකසා නැත. Render Environment එකේ OPENROUTER_API_KEY සකසන්න.";
  }

  // Model එක සකසා නැත්නම් fast & free model එකකට fallback වීම
  const targetModel = config.AI_MODEL || 'meta-llama/llama-3.2-3b-instruct:free';

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: targetModel,
        messages: [
          {
            role: 'system',
            content: `You are ${config.BOT_NAME || 'HESHAN-MD'}, an ultra-fast, intelligent, and friendly WhatsApp AI assistant created by Dinidu Heshan. Always answer helpfully, naturally, and concisely in Sinhala or English depending on user input.`
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
          'X-Title': config.BOT_NAME || 'HESHAN-MD'
        },
        timeout: 12000 // index.js එකට කලින් response එක ලබා ගැනීමට තත්පර 12කට සීමා කිරීම
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content;
    if (reply) {
      return reply.trim();
    } else {
      return '⚠️ AI එකෙන් පැහැදිලි පිළිතුරක් ලැබුණේ නැත.';
    }
  } catch (error) {
    console.error('AI API Error Details:', error?.response?.data || error.message);
    return '⚡ AI සේවාව හා සම්බන්ධ වීමේදී සුළු දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න.';
  }
}

module.exports = { askAI };
