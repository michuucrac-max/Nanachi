// -------------------------
//  NANACHI — INDEX.JS (PARTE 1)
// -------------------------

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType
} from "discord.js";

import fs from "fs";
import http from "http";

// =====================
// ENV
// =====================

const TOKEN = process.env.TOKEN;
const OWNER_ID = "1427297946151551148";

if (!TOKEN) {
  console.error("❌ Falta TOKEN");
  process.exit(1);
}

// =====================
// HISTORIA NANACHI
// =====================

let NANACHI_PROMPT = "Eres Nanachi.";

try {
  NANACHI_PROMPT = fs.readFileSync("nanachi.txt", "utf8");

  if (!NANACHI_PROMPT.trim()) {
    throw new Error("Vacío");
  }

  console.log("✅ Historia cargada");
} catch (err) {
  console.log("⚠️ Error cargando historia:", err.message);

  NANACHI_PROMPT = `
Eres Nanachi, sarcástica, tranquila y directa.
Respondes de forma natural y con personalidad.
`;
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

const memory = new Map();
const lastReply = new Map();

// =====================
// TEXTO
// =====================

function splitText(text, max = 1800) {
  if (typeof text !== "string") return [];

  const parts = [];
  let current = "";

  for (const line of text.split("\n")) {
    if ((current + line).length > max) {
      parts.push(current);
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }

  if (current.trim()) parts.push(current);

  return parts;
}

function limitReply(text, max = 1800) {
  if (typeof text !== "string") return "";
  return text.length <= max ? text : text.slice(0, max);
}

function cleanReply(text) {
  if (!text) return "";
  return text
    .replace(/^\s*\.+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// =====================
// GEMINI AI (FINAL)
// =====================

async function longcatAI(message, userId) {
  const API = process.env.GEMINI_API;

  if (!API) {
    return "Nanachi no tiene energía...";
  }

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
              role: "user",
              parts: [
                {
                  text: `${NANACHI_PROMPT}\n\nUsuario: ${message}`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await res.json();

    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Nanachi guarda silencio..."
    );

  } catch (err) {
    console.log(err);
    return "Nanachi guarda silencio...";
  }
}

// -------------------------
//  NANACHI — INDEX.JS (PARTE 2)
// -------------------------

client.once(Events.ClientReady, async () => {
  console.log(`✅ Conectada como ${client.user.tag}`);

  client.user.setActivity("Observando el Abismo…", {
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
    const call = /\b(nana|nanachi)\b/i;

    if (!isDM && !call.test(message.content)) return;

    const now = Date.now();
    const last = lastReply.get(message.author.id) ?? 0;

    if (now - last < 4000) return;

    lastReply.set(message.author.id, now);

    await message.channel.sendTyping();

    const reply = await longcatAI(
      message.content,
      message.author.id
    );

    if (!reply) return;

    const chunks = splitText(reply);

    await message.reply(chunks.shift());

    for (const chunk of chunks) {
      await message.channel.send(chunk);
    }

  } catch (err) {
    console.log("💥 ERROR MENSAJE:", err);
  }
});

// =====================
// WEB SERVICE
// =====================

http.createServer((_, res) => {
  res.writeHead(200);
  res.end("Nanachi vive...");
}).listen(process.env.PORT || 3000);

// =====================
// ANTI-CRASH
// =====================

process.on("uncaughtException", err => {
  console.log("💥 ERROR GLOBAL:", err);
});

process.on("unhandledRejection", err => {
  console.log("💥 PROMISE ERROR:", err);
});

// =====================
// LOGIN
// =====================

client.login(TOKEN);

