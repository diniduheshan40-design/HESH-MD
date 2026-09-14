const fetch = require('node-fetch');
const { OPENROUTER_API_KEY, AI_MODEL } = require('./config');

const chatHistory = new Map();

// අහන දේට කෙලින්ම, කෙටියෙන් උත්තර දෙන System Prompt එක
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
    const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
    const selectedModel = process.env.AI_MODEL || AI_MODEL || 'deepseek/deepseek-chat';

    if (!apiKey) {
      console.warn('⚠️ OPENROUTER_API_KEY is not set.');
      return "API Key එක සෙට් කරලා නෑ පැටියෝ 🥺";
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
        temperature: 0.5, // කියවීම අඩු කර අහන දේට පමණක් අවධානය යොමු කරයි
        max_tokens: 100    // මැසේජ් එක ලොකු නොවී කෙටි පිළිතුරකට සීමා කරයි
      }),
      timeout: 15000
    });

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      const aiReply = data.choices[0].message.content.trim();

      // Memory එකේ අන්තිම messages 4ක් පමණක් තබා ගනී (පැටලෙන්නේ නැතිවෙන්න)
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
    console.error('askAI Error:', error.message);
    return "පොඩි අවුලක් වුණා, පොඩ්ඩකින් ආයෙ කියන්නකො ❤️";
  }
}

module.exports = { askAI };
