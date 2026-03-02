console.log("INDEX FILE STARTED");

require('dotenv').config();

// ===== EXPRESS (חובה ל-Render) =====
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Web server running on port", process.env.PORT || 3000);
});

// ===== DISCORD =====
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

client.on("error", (err) => {
  console.log("CLIENT ERROR:", err);
});

client.on("shardError", (err) => {
  console.log("SHARD ERROR:", err);
});

client.on("debug", (msg) => {
  console.log("DEBUG:", msg);
});

// טעינת המערכות שלך
require('./antiSwear')(client);
require('./antiManagementPing')(client);

// כשהבוט מוכן
client.once('ready', () => {
  console.log(`🛡 Security Bot Ready: ${client.user.tag}`);
});

// בדיקה שהטוקן קיים
if (!process.env.TOKEN) {
  console.log("❌ TOKEN is missing in environment variables!");
} else {
  console.log("✅ TOKEN detected, logging in...");
client.login(process.env.TOKEN)
  .then(() => console.log("Login promise resolved"))
  .catch(err => console.log("LOGIN FAILED:", err));
}