const {
  AuditLogEvent,
  EmbedBuilder,
} = require("discord.js");

// =====================
// SETTINGS
// =====================

const SECURITY_LOG_CHANNEL_ID = "1471856785760583894";
const IMMUNE_ROLE_ID = "1472834722961952779";

const TIMEOUT_MINUTES = 10;

const SPAM_MAX_MESSAGES = 6;
const SPAM_TIME_WINDOW_MS = 5000;

const RAID_JOIN_LIMIT = 8;
const RAID_TIME_WINDOW_MS = 10000;

const NUKE_LIMIT = 3;
const NUKE_TIME_WINDOW_MS = 15000;

const BLOCKED_LINKS = [
  "discord.gg/",
  "discord.com/invite",
  "bit.ly",
  "tinyurl",
  "grabify",
  "iplogger",
  "free nitro",
  "steamcommunity.ru",
];

const PUNISH_BOT_ADDER = true;

// =====================
// HELPERS
// =====================

function isImmune(member) {
  return member?.roles?.cache?.has(IMMUNE_ROLE_ID);
}

function timeoutMs() {
  return TIMEOUT_MINUTES * 60 * 1000;
}

async function sendSecurityLog(guild, title, description) {
  try {
    const ch = await guild.channels.fetch(SECURITY_LOG_CHANNEL_ID).catch(() => null);
    if (!ch) return;

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: "Frogixx • Security System" })
      .setTimestamp();

    await ch.send({ embeds: [embed] });
  } catch {}
}

async function safeTimeout(member, reason) {
  try {
    if (!member || !member.moderatable) return;
    await member.timeout(timeoutMs(), reason).catch(() => {});
  } catch {}
}

async function safeKick(member, reason) {
  try {
    if (!member || !member.kickable) return;
    await member.kick(reason).catch(() => {});
  } catch {}
}

async function safeBan(member, reason) {
  try {
    if (!member || !member.bannable) return;
    await member.ban({ reason }).catch(() => {});
  } catch {}
}

async function getAuditExecutor(guild, type) {
  try {
    const logs = await guild.fetchAuditLogs({ limit: 1, type });
    const entry = logs.entries.first();
    if (!entry) return null;
    return entry.executor;
  } catch {
    return null;
  }
}

// =====================
// TRACKERS
// =====================

const spamTracker = new Map();
const raidTracker = [];
const nukeTracker = new Map();

// =====================
// ANTI SPAM
// =====================

async function handleSpam(message) {
  if (!message.guild || message.author.bot) return;

  const member = message.member;
  if (!member || isImmune(member)) return;

  const now = Date.now();

  if (!spamTracker.has(member.id)) spamTracker.set(member.id, []);
  const arr = spamTracker.get(member.id);

  arr.push(now);

  const filtered = arr.filter((t) => now - t <= SPAM_TIME_WINDOW_MS);
  spamTracker.set(member.id, filtered);

  if (filtered.length < SPAM_MAX_MESSAGES) return;

  await message.channel.bulkDelete(10).catch(() => {});
  await safeTimeout(member, "Spam detected");

  await sendSecurityLog(
    message.guild,
    "🚨 Anti Spam",
    `👤 משתמש: <@${member.id}>\n⛔ Timeout ${TIMEOUT_MINUTES} דקות`
  );

  spamTracker.delete(member.id);
}

// =====================
// ANTI LINKS
// =====================

async function handleLinks(message) {
  if (!message.guild || message.author.bot) return;

  const member = message.member;
  if (!member || isImmune(member)) return;

  const content = message.content.toLowerCase();

  const found = BLOCKED_LINKS.find((x) => content.includes(x));
  if (!found) return;

  await message.delete().catch(() => {});
  await safeTimeout(member, "Scam link");

  await sendSecurityLog(
    message.guild,
    "🔗 Scam Link",
    `👤 משתמש: <@${member.id}>\n🔗 זוהה: **${found}**`
  );
}

// =====================
// ANTI RAID
// =====================

async function handleRaid(member) {
  const now = Date.now();

  raidTracker.push(now);

  while (raidTracker.length && now - raidTracker[0] > RAID_TIME_WINDOW_MS) {
    raidTracker.shift();
  }

  if (raidTracker.length >= RAID_JOIN_LIMIT) {
    await sendSecurityLog(
      member.guild,
      "🚨 Anti Raid Alert",
      `⚠️ ${raidTracker.length} משתמשים נכנסו תוך ${RAID_TIME_WINDOW_MS / 1000} שניות`
    );

    raidTracker.length = 0;
  }
}

// =====================
// ANTI NUKE
// =====================

async function trackNuke(guild, member, action) {

  const now = Date.now();

  if (!nukeTracker.has(member.id)) nukeTracker.set(member.id, []);
  const arr = nukeTracker.get(member.id);

  arr.push(now);

  const filtered = arr.filter((t) => now - t <= NUKE_TIME_WINDOW_MS);
  nukeTracker.set(member.id, filtered);

  if (filtered.length >= NUKE_LIMIT) {

    await safeBan(member, "Server Nuke");
    nukeTracker.delete(member.id);

    await sendSecurityLog(
      guild,
      "💥 Anti Nuke",
      `👤 <@${member.id}> ניסה לבצע **${action}**`
    );

  }
}

// =====================
// CHANNEL DELETE
// =====================

async function handleChannelDelete(channel) {

  const executor = await getAuditExecutor(channel.guild, AuditLogEvent.ChannelDelete);
  if (!executor) return;

  const member = await channel.guild.members.fetch(executor.id).catch(() => null);
  if (!member || isImmune(member)) return;

  await trackNuke(channel.guild, member, "Channel Delete");

}

// =====================
// ROLE DELETE
// =====================

async function handleRoleDelete(role) {

  const executor = await getAuditExecutor(role.guild, AuditLogEvent.RoleDelete);
  if (!executor) return;

  const member = await role.guild.members.fetch(executor.id).catch(() => null);
  if (!member || isImmune(member)) return;

  await trackNuke(role.guild, member, "Role Delete");

}

// =====================
// BOT ADD
// =====================

async function handleBotAdd(member) {

  if (!member.user.bot) return;

  const executor = await getAuditExecutor(member.guild, AuditLogEvent.BotAdd);
  if (!executor) return;

  const adder = await member.guild.members.fetch(executor.id).catch(() => null);
  if (!adder || isImmune(adder)) return;

  await safeKick(member, "Unauthorized bot");

  if (PUNISH_BOT_ADDER) {
    await safeTimeout(adder, "Unauthorized bot add");
  }

  await sendSecurityLog(
    member.guild,
    "🤖 Unauthorized Bot",
    `👤 <@${adder.id}> הוסיף בוט\n🤖 הבוט הועף`
  );

}

// =====================
// REGISTER
// =====================

function registerSecuritySystem(client) {

  client.once("ready", () => {
    console.log("🛡 Security system loaded!");
  });

  client.on("messageCreate", async (message) => {
    await handleSpam(message);
    await handleLinks(message);
  });

  client.on("guildMemberAdd", async (member) => {
    await handleRaid(member);
    await handleBotAdd(member);
  });

  client.on("channelDelete", async (channel) => {
    await handleChannelDelete(channel);
  });

  client.on("roleDelete", async (role) => {
    await handleRoleDelete(role);
  });

}

module.exports = { registerSecuritySystem };