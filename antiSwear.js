const fs = require("fs");
const path = require("path");

const STAFF_IMMUNE_ROLE_ID = "1472834722961952779";
const LOG_CHANNEL_ID = "1470143249720279164";

const FILE_PATH = path.join(__dirname, "swear_data.json");

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

// ===== JSON HELPERS =====
function readData() {
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

function writeData(data) {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  } catch {}
}

// ===== REGISTER =====
function registerAntiSwear(client) {

  client.on("messageCreate", async (message) => {
    try {

      if (!message.guild) return;
      if (message.author.bot) return;
      if (!message.member) return;

      // חסינות
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

      // Timeout
      await message.member.timeout(timeoutMs, "קללות בשרת").catch(() => {});

      // הודעה בערוץ
      await message.channel.send(
        `⚠️ <@${message.author.id}> קיללת וקיבלת טיימאוט של **${timeoutMinutes} דקות**.\n` +
        `📈 בפעם הבאה זה יהיה כפול.`
      ).catch(() => {});

      // DM
      await message.author.send(
        `🚫 קיבלת טיימאוט של ${timeoutMinutes} דקות בגלל קללות.\n` +
        `אם תמשיך — זה יוכפל בכל פעם.`
      ).catch(() => {});

      // לוג
      const logChannel = await message.guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      if (logChannel) {
        await logChannel.send(
          `🚨 **אנטי קללות**\n` +
          `👤 משתמש: <@${message.author.id}>\n` +
          `⏳ טיימאוט: ${timeoutMinutes} דקות\n` +
          `📊 סטרייקים: ${data[message.author.id].strikes}`
        ).catch(() => {});
      }

    } catch (err) {
      console.log("❌ AntiSwear error:", err);
    }
  });

}

module.exports = registerAntiSwear;