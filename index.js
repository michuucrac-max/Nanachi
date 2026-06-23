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
import fetch from "node-fetch";
import http from "http";

// =====================
// ENV
// =====================

const TOKEN = process.env.TOKEN;
const LONGCAT_API = process.env.LONGCAT_API;

// 👉 ID al que quieres enviar errores
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
  NANACHI_PROMPT = fs.readFileSync(
    "nanachi.txt",
    "utf8"
  );

  console.log("✅ Historia cargada");
} catch {
  console.log("⚠️ No se encontró nanachi.txt");
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
// JSON
// =====================

const loadJSON = (file, def) => {
  try {
    return fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : def;
  } catch {
    return def;
  }
};

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

  if (current.trim()) {
    parts.push(current);
  }

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
// OPENROUTER AI
// =====================

async function longcatAI(message, userId) {
  const API = process.env.OPENROUTER_API;

  if (!API) {
    throw new Error("FALTA OPENROUTER_API");
  }

  const history = memory.get(userId) ?? [];

  history.push({
    role: "user",
    content: message
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "mistralai/mistral-7b-instruct",
          messages: [
            {
              role: "system",
              content: NANACHI_PROMPT
            },
            ...history
          ]
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.log("ERROR:", res.status, errText);
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    let reply = data?.choices?.[0]?.message?.content;

    if (!reply) throw new Error("Respuesta vacía");

    reply = cleanReply(limitReply(reply));

    history.push({
      role: "assistant",
      content: reply
    });

    memory.set(userId, history.slice(-8));

    return reply;

  } catch (err) {
    console.log("ERROR:", err);

    if (err.name === "AbortError") {
      return "Nanachi se distrajo...";
    }

    return "Nanachi guarda silencio...";
  }
}

// =====================
// READY
// =====================

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
});

// =====================
// WEB SERVICE
// =====================

http.createServer((_, res) => {
  res.writeHead(200);
  res.end("Nanachi vive...");
}).listen(process.env.PORT || 3000);

// =====================
// LOGIN
// =====================

client.login(TOKEN);
