const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

// ===== SETTINGS =====
const STAFF_ROLE_ID = "1462447685448630332";

const MANAGEMENT_ROLE_IDS = [
  "1461677799311016000",
  "1476234403217670166",
  "1461677804557959198",
  "1469758166467215514",
  "1462457760460439796",
];

const TIMEOUT_MINUTES = 10;
const FILE_PATH = path.join(__dirname, "management_ping_warns.json");
const SECRET_RESET_CMD = "!frogresetpingwarn";

// ===== JSON HELPERS =====
function readJsonSafe() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      fs.writeFileSync(FILE_PATH, JSON.stringify({}, null, 2));
    }
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeJsonSafe(data) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  } catch {}
}

// ===== HELPERS =====
function isStaff(member) {
  return member?.roles?.cache?.has(STAFF_ROLE_ID);
}

function isManagement(member) {
  return member && MANAGEMENT_ROLE_IDS.some(id => member.roles.cache.has(id));
}

function getWarns(userId) {
  const data = readJsonSafe();
  return Number(data[userId]) || 0;
}

function setWarns(userId, amount) {
  const data = readJsonSafe();
  data[userId] = amount;
  writeJsonSafe(data);
}

function addWarn(userId) {
  const warns = getWarns(userId) + 1;
  setWarns(userId, warns);
  return warns;
}

// ===== REGISTER FUNCTION =====
function registerAntiManagementPing(client) {

  client.on("messageCreate", async (message) => {
    try {
      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      // Reset command
      if (message.content.startsWith(SECRET_RESET_CMD)) {
        if (!isStaff(message.member)) return;

        const user = message.mentions.users.first();
        if (!user) {
          return message.reply("❌ שימוש: `!frogresetpingwarn @user`");
        }

        setWarns(user.id, 0);
        return message.reply(`✅ איפסתי אזהרות תיוג הנהלה ל־<@${user.id}>`);
      }

      if (!message.mentions.members?.size) return;
      if (isStaff(message.member)) return;

      const mentionedManagement = message.mentions.members.find(m => isManagement(m));
      if (!mentionedManagement) return;

      const warns = addWarn(message.author.id);

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("⚠️ אזהרה - תיוג הנהלה")
        .setDescription(
          `שלום <@${message.author.id}> 👋\n\n` +
          `❌ אסור לתייג את הנהלת השרת.\n` +
          `👮 תייגת: <@${mentionedManagement.id}>\n\n` +
          `📌 אזהרה: **${warns}/3**\n\n` +
          (warns >= 3
            ? `⛔ קיבלת Timeout ל־${TIMEOUT_MINUTES} דקות.`
            : `⚠️ באזהרה 3/3 תקבל Timeout.`)
        )
        .setFooter({ text: "Frogixx • Security System" })
        .setTimestamp();

      await message.reply({ embeds: [embed] }).catch(() => {});

      if (warns >= 3) {
        await message.member.timeout(
          TIMEOUT_MINUTES * 60 * 1000,
          "Tagged management 3 times"
        ).catch(() => {});

        setWarns(message.author.id, 0);
      }

    } catch (err) {
      console.log("❌ AntiManagementPing error:", err);
    }
  });

}

module.exports = registerAntiManagementPing;