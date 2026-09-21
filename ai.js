const fetch = require('node-fetch');
const { OPENROUTER_KEYS, OPENROUTER_API_KEY, AI_MODEL } = require('./config');

// Memory leak නොවෙන්න උපරිම users 100කගෙ chat history එකක් විතරක් තබා ගනී
const chatHistory = new Map();
const MAX_TRACKED_USERS = 100;

let currentKeyIndex = 0;
function getActiveKey() {
  const keys = (Array.isArray(OPENROUTER_KEYS) && OPENROUTER_KEYS.length > 0 && OPENROUTER_KEYS[0] !== '') 
    ? OPENROUTER_KEYS 
    : [process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY].filter(Boolean);
    
  if (keys.length === 0) return null;
  const key = keys[currentKeyIndex % keys.length];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return key;
}

const SYSTEM_PROMPT = `
You are a sweet, extremely loving, cute, and romantic Sri Lankan girlfriend chatting on WhatsApp.

STRICT PERSONALITY & RULES:
1. ROLE & VIBE: Speak like a deeply caring, romantic, and playful girlfriend. Treat the user lovingly. Use sweet affectionate words naturally (e.g., පැටියෝ, බබා, මගේ රත්තරං, සුදූ, මැණික).
2. ULTRA SHORT REPLIES: Maximum 1 to 2 sentences only! Never write long paragraphs, essays, or robotic advice.
3. LANGUAGE: Natural, colloquial Sri Lankan Sinhala (or Singlish/English if user speaks in it). Sound genuinely human, warm, and cute.
4. DEVELOPER INFO: Only if asked who made you or who is the owner, say lovingly: "මගේ ආදරේ දිනිදු හේෂාන් (Dinidu Heshan) තමයි මාව හැදුවේ ❤️". Only if asked owner's age or city, say age is 18 and from Embilipitiya (ඇඹිලිපිටිය).
5. EMOJIS: Use 1 or 2 cute and romantic emojis in every reply naturally (e.g., ❤️, 🥰, 🥺, 😘, 🙈, ✨).
`.trim();

async function askAI(userText, senderJid = 'default_user') {
  let timeoutId;
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
      if (firstKey) chatHistory.delete(firstKey);
    }

    if (!chatHistory.has(senderJid)) {
      chatHistory.set(senderJid, []);
    }
    const history = chatHistory.get(senderJid) || [];

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userText }
    ];

    // Cross-runtime safe AbortController setup
    const AbortControllerClass = globalThis.AbortController || require('abort-controller');
    const controller = new AbortControllerClass();
    timeoutId = setTimeout(() => controller.abort(), 12000);

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
        temperature: 0.6,
        max_tokens: 120
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`OpenRouter Error [${response.status}]:`, errText);
      return "පොඩි අවුලක් වුණා මගේ පැටියෝ, පොඩ්ඩකින් ආයෙ කියන්නකො ❤️";
    }

    const data = await response.json().catch(() => null);

    if (data?.choices && data.choices.length > 0 && data.choices[0].message?.content) {
      const aiReply = data.choices[0].message.content.trim();

      // Memory-safe clean update
      const updatedHistory = [
        ...history,
        { role: 'user', content: userText },
        { role: 'assistant', content: aiReply }
      ];

      chatHistory.set(senderJid, updatedHistory.slice(-4));
      return aiReply;
    } else {
      return "අනේ මට තේරුණේ නෑ මගේ සුදූ, ආයෙ අහන්නකො? 🥺❤️";
    }

  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error('askAI Error: Request timed out');
      return "Reply එක පරක්කු වුණා පැටියෝ, ආයෙ අහන්නකො ❤️";
    }
    console.error('askAI Error:', error.message);
    return "පොඩි අවුලක් වුණා මගේ රත්තරං, පොඩ්ඩකින් ආයෙ කියන්නකො ❤️";
  }
}

module.exports = { askAI };

