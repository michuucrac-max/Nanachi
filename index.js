// =====================
// NANACHI BOT — PRO VERSION
// =====================

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType
} from "discord.js";

import fetch from "node-fetch";
import fs from "fs";
import http from "http";

// =====================
// ENV
// =====================

const TOKEN = process.env.TOKEN;
const GEMINI_API = process.env.GEMINI_API;
const OWNER_ID = "1427297946151551148";

if (!TOKEN) {
  console.error("❌ Falta TOKEN de Discord");
  process.exit(1);
}

if (!GEMINI_API) {
  console.error("❌ Falta GEMINI_API (Nanachi no tendrá energía)");
}

// =====================
// PROMPT
// =====================

let NANACHI_PROMPT = "Eres Nanachi.";

try {
  const file = fs.readFileSync("nanachi.txt", "utf8");

  if (file.trim()) {
    NANACHI_PROMPT = file;
    console.log("✅ Historia cargada");
  }
} catch {
  console.log("⚠️ Usando prompt por defecto");
}

// =====================
// CLIENT
// =====================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// =====================
// MEMORY SYSTEM
// =====================

const memory = new Map();
const cooldown = new Map();

// =====================
// HELPERS
// =====================

function clean(text = "") {
  return text
    .replace(/^\s*\.+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunk(text, size = 1800) {
  const parts = [];
  for (let i = 0; i < text.length; i += size) {
    parts.push(text.slice(i, i + size));
  }
  return parts;
}

// =====================
// GEMINI REQUEST
// =====================

async function askGemini(userId, message) {
  if (!GEMINI_API) {
    return "Nanachi no tiene energía...";
  }

  const history = memory.get(userId) || [];

  const formattedHistory = history
    .map(h => `${h.role === "user" ? "Usuario" : "Nanachi"}: ${h.content}`)
    .join("\n");

  const prompt = `
${NANACHI_PROMPT}

${formattedHistory}

Usuario: ${message}
Nanachi:
`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    );

    const text = await res.text();

    if (!res.ok) {
      console.log("❌ GEMINI ERROR:", text);
      return "Nanachi mira al vacío… algo salió mal.";
    }

    const data = JSON.parse(text);

    let reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      console.log("⚠️ Respuesta vacía:", text);
      return "Nanachi se queda pensando...";
    }

    reply = clean(reply);

    // Guardar memoria
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: reply });

    memory.set(userId, history.slice(-10));

    return reply;

  } catch (err) {
    console.log("💥 ERROR GEMINI:", err);
    return "Nanachi guarda silencio...";
  }
}

// =====================
// READY
// =====================

client.once(Events.ClientReady, () => {
  console.log(`✅ Conectada como ${client.user.tag}`);

  client.user.setActivity("El Abismo...", {
    type: ActivityType.Playing
  });
});

// =====================
// MESSAGE HANDLER
// =====================

client.on(Events.MessageCreate, async message => {
  try {
    if (message.author.bot) return;

    const isDM = !message.guild;
    const trigger = /\b(nana|nanachi)\b/i;

    if (!isDM && !trigger.test(message.content)) return;

    // Cooldown
    const now = Date.now();
    const last = cooldown.get(message.author.id) || 0;

    if (now - last < 3000) return;

    cooldown.set(message.author.id, now);

    await message.channel.sendTyping();

    const reply = await askGemini(
      message.author.id,
      message.content
    );

    const parts = chunk(reply);

    await message.reply(parts[0]);

    for (let i = 1; i < parts.length; i++) {
      await message.channel.send(parts[i]);
    }

  } catch (err) {
    console.log("💥 ERROR MENSAJE:", err);
  }
});

// =====================
// KEEP ALIVE (RENDER)
// =====================

http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("Nanachi vive 🐇");
  })
  .listen(process.env.PORT || 3000);

// =====================
// ANTI CRASH
// =====================

process.on("uncaughtException", err => {
  console.log("💥 GLOBAL ERROR:", err);
});

process.on("unhandledRejection", err => {
  console.log("💥 PROMISE ERROR:", err);
});

// =====================
// LOGIN
// =====================

client.login(TOKEN);
