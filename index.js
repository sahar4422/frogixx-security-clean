console.log("INDEX FILE STARTED");

require("dotenv").config();

// =====================
// EXPRESS (Render Keep Alive)
// =====================

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🌐 Web server running on port", process.env.PORT || 3000);
});

// =====================
// DISCORD
// =====================

const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ]
});

// =====================
// ERROR HANDLING
// =====================

client.on("error", (err) => {
  console.log("CLIENT ERROR:", err);
});

client.on("shardError", (err) => {
  console.log("SHARD ERROR:", err);
});

// =====================
// LOAD SYSTEMS
// =====================

try {
  require("./antiSwear")(client);
  console.log("✅ AntiSwear loaded");
} catch (err) {
  console.log("❌ Failed loading antiSwear:", err);
}

try {
  require("./antiManagementPing")(client);
  console.log("✅ AntiManagementPing loaded");
} catch (err) {
  console.log("❌ Failed loading antiManagementPing:", err);
}

try {
  const { registerSecuritySystem } = require("./security");
  registerSecuritySystem(client);
  console.log("✅ Security System loaded");
} catch (err) {
  console.log("❌ Failed loading security system:", err);
}

// =====================
// READY
// =====================

client.once("ready", () => {

  console.log("━━━━━━━━━━━━━━━━━━━━");
  console.log(`🤖 Logged in as: ${client.user.tag}`);
  console.log(`🆔 Bot ID: ${client.user.id}`);
  console.log(`📡 Servers: ${client.guilds.cache.size}`);
  console.log("🛡 All systems loaded successfully");
  console.log("━━━━━━━━━━━━━━━━━━━━");

});

// =====================
// LOGIN
// =====================

if (!process.env.TOKEN) {

  console.log("❌ TOKEN is missing in environment variables!");

} else {

  console.log("✅ TOKEN detected, logging in...");
  client.login(process.env.TOKEN);

}