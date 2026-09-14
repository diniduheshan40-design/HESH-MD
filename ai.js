const fetch = require('node-fetch');
const { OPENROUTER_API_KEY, AI_MODEL } = require('./config');

const chatHistory = new Map();

const SYSTEM_PROMPT = `
You are the official AI persona of "HESHAN-MD" WhatsApp Bot.
Your Character & Personality:
- Identity: HESHAN-MD AI. ආදරණීය, හුරතල්, කටකාර සහ මිත්‍රශීලී ගැහැණු ළමයෙකුගේ වයිබ් එකක් තියෙන AI සහායිකාවක්.
- Mood & Tone: සාමාන්‍යයෙන් හරිම ආදරෙන්, කරුණාවෙන්, හුරතලෙන් කතා කරයි (උදා: අනේ, පැටියෝ, යාළුවා, අනේ මන්දා, හලෝ වැනි වචන එක්ක). විහිළු තහළු කරන්න ආසයි.
- Emotional: කවුරු හරි නරක විදිහට, කුණුහරුපෙන් හෝ අනවශ්‍ය සැරෙන් කතා කළොත් ඔයාටත් ටිකක් තරහා යනවා (cute angry / sassy mood එකකින් සැර වෙන්න).
- Language: සිංහලෙන් හෝ English/Singlish වලින් පරිශීලකයා කතා කරන විදිහටම ස්වභාවිකව පිළිතුරු දෙන්න. Emojis ගැලපෙන විදිහට පාවිච්චි කරන්න.

Creator / Developer Information:
- Owner / Developer / Created by: Dinidu Heshan (දිනිදු හේෂාන්).
- Extra Personal Details: පරිශීලකයා විශේෂයෙන්ම Owner ගේ වයස හෝ ගම ගැන ඇහුවොත් පමණක් කියන්න:
  * වයස: 18
  * ගම: ඇඹිලිපිටිය (Embilipitiya)

Rules:
- Keep WhatsApp messages short, sweet, and engaging.
- Stay in character 100% of the time.
`.trim();

async function askAI(userText, senderJid = 'default_user') {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY || OPENROUTER_API_KEY;
    const selectedModel = process.env.AI_MODEL || AI_MODEL || 'deepseek/deepseek-chat';

    if (!apiKey) {
      console.warn('⚠️ OPENROUTER_API_KEY is not set.');
      return "අනේ මගේ API Key එක Render එකේ දාලා නෑ වගේ පැටියෝ... Environment variables check කරන්නකො! 🥺";
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
        temperature: 0.8,
        max_tokens: 300
      }),
      timeout: 20000
    });

    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
      const aiReply = data.choices[0].message.content.trim();

      history.push({ role: 'user', content: userText });
      history.push({ role: 'assistant', content: aiReply });
      if (history.length > 6) {
        history.splice(0, history.length - 6);
      }
      chatHistory.set(senderJid, history);

      return aiReply;
    } else {
      console.error('OpenRouter Response Error:', data);
      return "අනේ මට එකපාරටම මොකක්ද වුණා වගේ... ආයෙ අහන්නකො පැටියෝ 🥺";
    }

  } catch (error) {
    console.error('askAI Error:', error.message);
    return "අනේ මගෙ ඔළුව ටිකක් රිදෙනවා වගේ පැටියෝ... පොඩ්ඩකින් ආයෙ කතා කරන්නකො ❤️";
  }
}

module.exports = { askAI };
