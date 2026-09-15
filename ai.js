const fetch = require('node-fetch');
const { OPENROUTER_KEYS, OPENROUTER_API_KEY, AI_MODEL } = require('./config');

// Memory leak නොවෙන්න උපරිම users 100කගෙ chat history එකක් විතරක් තබා ගනී
const chatHistory = new Map();
const MAX_TRACKED_USERS = 100;

let currentKeyIndex = 0;
function getActiveKey() {
  const keys = (OPENROUTER_KEYS && OPENROUTER_KEYS.length > 0 && OPENROUTER_KEYS[0] !== '') 
    ? OPENROUTER_KEYS 
    : [process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY].filter(Boolean);
    
  if (keys.length === 0) return null;
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return key;
}

const SYSTEM_PROMPT = `
You are HESHAN-MD AI, a smart, friendly, and cute WhatsApp assistant.

STRICT RULES:
1. KEEP REPLIES VERY SHORT: Maximum 1 to 2 sentences only! Never write long paragraphs or essays.
2. ANSWER DIRECTLY: Answer exactly what the user asks. Do not give unsolicited advice or random talk.
3. LANGUAGE: Reply in natural Sinhala (or Singlish/English if user speaks in it). Sound human, warm, and cute, NOT robotic.
4. DEVELOPER INFO: Only if asked who made you or who is the owner, say it is Dinidu Heshan (දිනිදු හේෂාන්). Only if asked owner's age or city, say age is 18 and from Embilipitiya (ඇඹිලිපිටිය).
5. EMOJIS: Use 1 or 2 cute emojis naturally.
`.trim();

async function askAI(userText, senderJid = 'default_user') {
  try {
    const apiKey = getActiveKey();
    const selectedModel = process.env.AI_MODEL || AI_MODEL || 'deepseek/deepseek-chat';

    if (!apiKey) {
      console.warn('⚠️ OPENROUTER_API_KEY is missing or empty.');
      return "API Key එක සෙට් කරලා නෑ පැටියෝ 🥺";
    }

    // Cache cleanup - memory leak prevention
    if (chatHistory.size > MAX_TRACKED_USERS) {
      const firstKey = chatHistory.keys().next().value;
      chatHistory.delete(firstKey);
    }

    if (!chatHistory.has(senderJid)) {
      chatHistory.set(senderJid, []);
    }
    const history = chatHistory.get(senderJid);

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userText }
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/DiniduHeshan/HESHAN-MD',
        'X-Title': 'HESHAN-MD Bot',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: messages,
        temperature: 0.5,
        max_tokens: 120
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`OpenRouter Error [${response.status}]:`, errText);
      return "පොඩි අවුලක් වුණා, පොඩ්ඩකින් ආයෙ කියන්නකො ❤️";
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
      const aiReply = data.choices[0].message.content.trim();

      history.push({ role: 'user', content: userText });
      history.push({ role: 'assistant', content: aiReply });
      if (history.length > 4) {
        history.splice(0, history.length - 4);
      }
      chatHistory.set(senderJid, history);

      return aiReply;
    } else {
      return "අනේ මට තේරුණේ නෑ, ආයෙ අහන්නකො? 🥺";
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('askAI Error: Request timed out');
      return "Reply එක පරක්කු වුණා, ආයෙ අහන්නකො ❤️";
    }
    console.error('askAI Error:', error.message);
    return "පොඩි අවුලක් වුණා, පොඩ්ඩකින් ආයෙ කියන්නකො ❤️";
  }
}

module.exports = { askAI };
