const { PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const path = require("path");

const STAFF_IMMUNE_ROLE_ID = "1472834722961952779"; // רול חסין
const LOG_CHANNEL_ID = "1470143249720279164"; // חדר לוגים

const FILE_PATH = path.join(__dirname, "swear_data.json");

// קללות (תוסיף מה שבא לך)
const BAD_WORDS = [
  "בן זונה",
  "זונה",
  "כוסאמק",
  "זין",
  "אמא שלך",
  "חולה",
  "סרטן",
  "הומו",
  "אבא שלך",
  "תמות אמן",
  "ניגר",
  "שרת גרוע",
  "שרמוטה",
  "fuck",
  "shit"
];

// ===== JSON =====
function readData() {
  if (!fs.existsSync(FILE_PATH))
    fs.writeFileSync(FILE_PATH, JSON.stringify({}, null, 2));

  return JSON.parse(fs.readFileSync(FILE_PATH));
}

function writeData(data) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

// ===== REGISTER =====
function registerAntiSwear(client) {

  client.on("messageCreate", async (message) => {

    if (!message.guild) return;
    if (message.author.bot) return;

    // חסין
    if (message.member.roles.cache.has(STAFF_IMMUNE_ROLE_ID)) return;

    const content = message.content.toLowerCase();

    const found = BAD_WORDS.some(word => content.includes(word));
    if (!found) return;

    await message.delete().catch(() => {});

    let data = readData();

    if (!data[message.author.id]) {
      data[message.author.id] = {
        strikes: 0,
        timeoutMinutes: 10
      };
    }

    data[message.author.id].strikes += 1;

    const timeoutMinutes = data[message.author.id].timeoutMinutes;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    // מכפיל לפעם הבאה
    data[message.author.id].timeoutMinutes *= 2;

    writeData(data);

    // טיימאוט
    await message.member.timeout(timeoutMs, "קללות בשרת").catch(() => {});

    // הודעה בחדר
    await message.channel.send(
      `⚠️ <@${message.author.id}> קיללת וקיבלת טיימאוט של **${timeoutMinutes} דקות**.\n` +
      `📈 בפעם הבאה זה יהיה כפול.`
    );

    // DM
    await message.author.send(
      `🚫 קיללת בשרת וקיבלת טיימאוט של ${timeoutMinutes} דקות.\n` +
      `אם תמשיך — זה יוכפל בכל פעם.`
    ).catch(() => {});

    // לוג
    const logChannel = await message.guild.channels
      .fetch(LOG_CHANNEL_ID)
      .catch(() => null);

    if (logChannel) {
      await logChannel.send(
        `🚨 **אנטי קללות**\n` +
        `👤 משתמש: <@${message.author.id}>\n` +
        `⏳ טיימאוט: ${timeoutMinutes} דקות\n` +
        `📊 סטרייקים: ${data[message.author.id].strikes}`
      );
    }

  });

}

module.exports = { registerAntiSwear };