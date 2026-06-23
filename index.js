// =====================
// NANACHI BOT — DEBUG TOTAL
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

console.log("🔍 DEBUG ENV:");
console.log("TOKEN:", TOKEN ? "OK" : "❌ FALTA");
console.log("GEMINI_API:", GEMINI_API ? "OK" : "❌ FALTA");

if (!TOKEN) {
  console.error("❌ TOKEN no definido");
  process.exit(1);
}

// =====================
// PROMPT
// =====================

let NANACHI_PROMPT = "Eres Nanachi, sarcástica, directa y tranquila.";

try {
  const file = fs.readFileSync("nanachi.txt", "utf8");
  if (file.trim()) {
    NANACHI_PROMPT = file;
    console.log("✅ Prompt cargado");
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
// MEMORY + COOLDOWN
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
// GEMINI (DEBUG REAL)
// =====================

async function askGemini(userId, message) {
  const API = process.env.GEMINI_API;

  console.log("🔑 GEMINI_API:", API ? "OK" : "UNDEFINED");

  if (!API) {
    return "❌ ERROR: GEMINI_API no está definida en Render.";
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
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API}`,
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

    const raw = await res.text();

    console.log("📡 STATUS:", res.status);
    console.log("📡 RESPUESTA CRUDA:", raw);

    if (!res.ok) {
      return `❌ ERROR GEMINI (${res.status}):\n${raw}`;
    }

    const data = JSON.parse(raw);

    let reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return `⚠️ Gemini respondió vacío:\n${raw}`;
    }

    reply = clean(reply);

    // Guardar memoria
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: reply });

    memory.set(userId, history.slice(-10));

    return reply;

  } catch (err) {
    console.log("💥 ERROR FETCH:", err);
    return `💥 ERROR FETCH:\n${err.message}`;
  }
}

// =====================
// READY
// =====================

client.once(Events.ClientReady, () => {
  console.log(`✅ Conectada como ${client.user.tag}`);

  client.user.setActivity("Observando el Abismo...", {
    type: ActivityType.Playing
  });
});

// =====================
// MENSAJES
// =====================

client.on(Events.MessageCreate, async message => {
  try {
    if (message.author.bot) return;

    const isDM = !message.guild;
    const trigger = /\b(nana|nanachi)\b/i;

    if (!isDM && !trigger.test(message.content)) return;

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
// ANTI-CRASH
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
