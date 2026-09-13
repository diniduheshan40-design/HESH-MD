const axios = require('axios');
require('dotenv').config();

async function askAI(prompt) {
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are Heshan AI, a friendly, intelligent WhatsApp assistant. Answer concisely and naturally.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://render.com',
          'X-Title': 'Heshan AI Bot'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('AI Error:', error?.response?.data || error.message);
    return 'කණගාටුයි, AI සේවාව හා සම්බන්ධ වීමේදී දෝෂයක් ඇති විය.';
  }
}

module.exports = { askAI };
