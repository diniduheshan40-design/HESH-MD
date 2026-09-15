require('dotenv').config();

// Helper to safely parse multiple API keys separated by commas
const parseKeys = () => {
  const envKeys = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || "";
  const keys = envKeys.split(',').map(k => k.trim()).filter(Boolean);
  return keys.length > 0 ? keys : [""];
};

module.exports = {
  // Database URL (Ensure database name is explicitly attached)
  MONGODB_URI: process.env.MONGODB_URI || "mongodb+srv://kethmi12345_db_user:nipun1234@cluster0.3fhoect.mongodb.net/heshan_bot?retryWrites=true&w=majority",
  
  // OpenRouter API Keys Array
  OPENROUTER_KEYS: parseKeys(),
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  
  // Default AI Model
  AI_MODEL: process.env.AI_MODEL || "deepseek/deepseek-chat",

  // Bot Metadata
  BOT_NAME: process.env.BOT_NAME || "HESHAN-MD",
  OWNER_NUMBER: process.env.OWNER_NUMBER || "94719845166",
  PORT: process.env.PORT || 3000
};
