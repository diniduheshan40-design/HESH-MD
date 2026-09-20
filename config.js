require('dotenv').config();

// Helper to safely parse multiple API keys separated by commas
const parseKeys = () => {
  const envKeys = process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || "";
  const keys = envKeys.split(',').map(k => k.trim()).filter(Boolean);
  return keys;
};

// Ensure MongoDB URI has a safe connection pool limit for free tiers
const rawMongoUri = process.env.MONGODB_URI || "mongodb+srv://diniduheshan40_db_user:Heshan2007@cluster0.5gazebm.mongodb.net/HESHAN-MD?retryWrites=true&w=majority&appName=Cluster0";
const MONGODB_URI = rawMongoUri.includes('maxPoolSize') 
  ? rawMongoUri 
  : `${rawMongoUri}&maxPoolSize=10`;

module.exports = {
  // Database URL (Safe Pool Size)
  MONGODB_URI,
  
  // OpenRouter API Keys Array
  OPENROUTER_KEYS: parseKeys(),
  OPENROUTER_API_KEY: (process.env.OPENROUTER_API_KEY || "").trim(),
  
  // Default AI Model
  AI_MODEL: (process.env.AI_MODEL || "deepseek/deepseek-chat").trim(),

  // Bot Metadata
  BOT_NAME: (process.env.BOT_NAME || "HESHAN-MD").trim(),
  OWNER_NUMBER: (process.env.OWNER_NUMBER || "94719845166").replace(/[^0-9]/g, ''),
  PORT: process.env.PORT || 3000
};
