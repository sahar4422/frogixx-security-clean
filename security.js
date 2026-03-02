const {
  AuditLogEvent,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");

// =====================
// SETTINGS
// =====================

// 🔥 חדר לוגים של האבטחה (תשים פה אם יש לך חדר לוגים מיוחד)
const SECURITY_LOG_CHANNEL_ID = "1471856785760583894"; // אפשר לשנות

// ⛔ רק הרול הזה חסין (כמו שביקשת)
const IMMUNE_ROLE_ID = "1472834722961952779";

// עונש
const TIMEOUT_MINUTES = 10;

// Anti Spam
const SPAM_MAX_MESSAGES = 6;
const SPAM_TIME_WINDOW_MS = 5000;

// Anti Raid (רק התראה)
const RAID_JOIN_LIMIT = 8;
const RAID_TIME_WINDOW_MS = 10000;

// Anti Nuke
const NUKE_LIMIT = 3;
const NUKE_TIME_WINDOW_MS = 15000;

// Anti Scam Links
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

// Anti Bot Add
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
 if (!member) return false;

console.log("moderatable?", member.moderatable, "user:", member.user.tag);
    await member.timeout(timeoutMs(), reason).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

async function safeKick(member, reason) {
  try {
    if (!member || !member.kickable) return false;
    await member.kick(reason).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

async function safeBan(member, reason) {
  try {
    if (!member || !member.bannable) return false;
    await member.ban({ reason }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

async function getAuditExecutor(guild, type) {
  try {
    const logs = await guild.fetchAuditLogs({ limit: 1, type }).catch(() => null);
    if (!logs) return null;
    const entry = logs.entries.first();
    if (!entry) return null;

    // executor = מי עשה
    return entry.executor || null;
  } catch {
    return null;
  }
}

// =====================
// TRACKERS
// =====================
const spamTracker = new Map();
// userId -> [{time, msgId}]

const raidTracker = [];
// [{time, userId}]

const nukeTracker = new Map();
// userId -> [timestamps]

// =====================
// ANTI SPAM
// =====================
async function handleSpam(message) {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const member = message.member;
    if (!member) return;

    // רק הרול הזה חסין
    if (isImmune(member)) return;

    const now = Date.now();

    if (!spamTracker.has(message.author.id)) spamTracker.set(message.author.id, []);
    const arr = spamTracker.get(message.author.id);

    // מוסיף הודעה
    arr.push({ time: now, id: message.id });

    // מסנן חלון זמן
    const filtered = arr.filter((x) => now - x.time <= SPAM_TIME_WINDOW_MS);
    spamTracker.set(message.author.id, filtered);

    if (filtered.length < SPAM_MAX_MESSAGES) return;

    // מוחק הודעות אחרונות (עד 10)
    const channel = message.channel;
    const messages = await channel.messages.fetch({ limit: 15 }).catch(() => null);

    if (messages) {
      const toDelete = messages
        .filter((m) => m.author.id === message.author.id)
        .first(10);

      for (const m of toDelete) {
        await m.delete().catch(() => {});
      }
    }

    // timeout
    await safeTimeout(member, "Frogixx Security: Spam");

    await sendSecurityLog(
      message.guild,
      "🚨 Anti-Spam Triggered",
      `👤 משתמש: <@${message.author.id}>\n📌 פעולה: **Spam**\n⛔ עונש: **Timeout ${TIMEOUT_MINUTES} דקות**`
    );

    // מנקה כדי שלא יעניש 50 פעם
    spamTracker.delete(message.author.id);
  } catch {}
}

// =====================
// ANTI LINKS
// =====================
async function handleLinks(message) {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const member = message.member;
    if (!member) return;

    if (isImmune(member)) return;

    const content = message.content.toLowerCase();

    const found = BLOCKED_LINKS.find((x) => content.includes(x));
    if (!found) return;

    await message.delete().catch(() => {});
    await safeTimeout(member, `Frogixx Security: Scam link (${found})`);

    await sendSecurityLog(
      message.guild,
      "🔗 Anti-Scam Link",
      `👤 משתמש: <@${message.author.id}>\n📌 לינק/מילה: **${found}**\n⛔ עונש: **Timeout ${TIMEOUT_MINUTES} דקות**\n\n🧾 תוכן:\n\`\`\`${message.content.slice(0, 1000)}\`\`\``
    );
  } catch {}
}

// =====================
// ANTI RAID (JOIN)
// =====================
async function handleRaid(member) {
  try {
    if (!member.guild) return;
    if (member.user.bot) return;

    const now = Date.now();
    raidTracker.push({ time: now, userId: member.id });

    // מסנן
    while (raidTracker.length && now - raidTracker[0].time > RAID_TIME_WINDOW_MS) {
      raidTracker.shift();
    }

    if (raidTracker.length >= RAID_JOIN_LIMIT) {
      await sendSecurityLog(
        member.guild,
        "🚨 Anti-Raid Alert",
        `⚠️ נכנסו **${raidTracker.length} משתמשים** תוך **${Math.floor(
          RAID_TIME_WINDOW_MS / 1000
        )} שניות**.\n\n📌 זה רק התראה (לא מעניש אוטומטי).`
      );

      raidTracker.length = 0;
    }
  } catch {}
}

// =====================
// ANTI NUKE (CHANNEL DELETE)
// =====================
async function handleChannelDelete(channel) {
  try {
    const guild = channel.guild;
    if (!guild) return;

    const executor = await getAuditExecutor(guild, AuditLogEvent.ChannelDelete);
    if (!executor) return;

    const member = await guild.members.fetch(executor.id).catch(() => null);
    if (!member) return;

    if (isImmune(member)) return;

    const now = Date.now();

    if (!nukeTracker.has(member.id)) nukeTracker.set(member.id, []);
    const arr = nukeTracker.get(member.id);

    arr.push(now);

    // מסנן חלון זמן
    const filtered = arr.filter((t) => now - t <= NUKE_TIME_WINDOW_MS);
    nukeTracker.set(member.id, filtered);

    if (filtered.length >= NUKE_LIMIT) {
      await safeBan(member, "Frogixx Security: Channel Nuke");
      await sendSecurityLog(
        guild,
        "💥 Anti-Nuke Triggered (Channels)",
        `👤 מי עשה: <@${member.id}>\n📌 פעולה: **מחק חדרים**\n⛔ עונש: **BAN**\n🧨 כמות: ${filtered.length} תוך ${NUKE_TIME_WINDOW_MS / 1000} שניות`
      );
      nukeTracker.delete(member.id);
    } else {
      await sendSecurityLog(
        guild,
        "⚠️ Channel Deleted",
        `👤 מי מחק: <@${member.id}>\n📌 חדר: **${channel.name}**\n📊 ספירה: ${filtered.length}/${NUKE_LIMIT}`
      );
    }
  } catch {}
}

// =====================
// ANTI NUKE (ROLE DELETE)
// =====================
async function handleRoleDelete(role) {
  try {
    const guild = role.guild;
    if (!guild) return;

    const executor = await getAuditExecutor(guild, AuditLogEvent.RoleDelete);
    if (!executor) return;

    const member = await guild.members.fetch(executor.id).catch(() => null);
    if (!member) return;

    if (isImmune(member)) return;

    const now = Date.now();

    if (!nukeTracker.has(member.id)) nukeTracker.set(member.id, []);
    const arr = nukeTracker.get(member.id);

    arr.push(now);

    const filtered = arr.filter((t) => now - t <= NUKE_TIME_WINDOW_MS);
    nukeTracker.set(member.id, filtered);

    if (filtered.length >= NUKE_LIMIT) {
      await safeBan(member, "Frogixx Security: Role Nuke");
      await sendSecurityLog(
        guild,
        "💥 Anti-Nuke Triggered (Roles)",
        `👤 מי עשה: <@${member.id}>\n📌 פעולה: **מחק רולים**\n⛔ עונש: **BAN**\n🧨 כמות: ${filtered.length} תוך ${NUKE_TIME_WINDOW_MS / 1000} שניות`
      );
      nukeTracker.delete(member.id);
    } else {
      await sendSecurityLog(
        guild,
        "⚠️ Role Deleted",
        `👤 מי מחק: <@${member.id}>\n📌 רול: **${role.name}**\n📊 ספירה: ${filtered.length}/${NUKE_LIMIT}`
      );
    }
  } catch {}
}

// =====================
// ANTI BOT ADD
// =====================
async function handleBotAdd(member) {
  try {
    if (!member.guild) return;
    if (!member.user.bot) return;

    const guild = member.guild;

    const executor = await getAuditExecutor(guild, AuditLogEvent.BotAdd);
    if (!executor) return;

    const adder = await guild.members.fetch(executor.id).catch(() => null);
    if (!adder) return;

    if (isImmune(adder)) return;

    // מעיף את הבוט שנוסף
    await safeKick(member, "Frogixx Security: Unauthorized bot");

    // מעניש את מי שהוסיף
    if (PUNISH_BOT_ADDER) {
      await safeTimeout(adder, "Frogixx Security: Added bot");
    }

    await sendSecurityLog(
      guild,
      "🤖 Anti Bot-Add Triggered",
      `👤 מי הוסיף: <@${adder.id}>\n🤖 בוט שנוסף: <@${member.id}>\n⛔ פעולה: הבוט הועף + נותן Timeout למוסיף`
    );
  } catch {}
}

// =====================
// REGISTER
// =====================
function registerSecuritySystem(client) {
  client.once("ready", () => {
    console.log("🛡️ Security system loaded (IMMUNE ROLE ONLY)!");
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