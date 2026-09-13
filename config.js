require('dotenv').config();

module.exports = {
  // Database URL
  MONGODB_URI: process.env.MONGODB_URI || "mongodb+srv://kethmi12345_db_user:nipun1234@cluster0.3fhoect.mongodb.net/?retryWrites=true&w=majority",
  
  // AI API Keys
  OPENROUTER_KEYS: [process.env.OPENROUTER_API_KEY],
  
  // Default AI Model
  AI_MODEL: process.env.AI_MODEL || "deepseek/deepseek-chat",

  // Bot Metadata
  BOT_NAME: process.env.BOT_NAME || "HESHAN-MD",
  OWNER_NUMBER: "94719845166",
  PORT: process.env.PORT || 3000
};
