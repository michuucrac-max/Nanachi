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

// ⚠️ NO uses node-fetch en Node 18+
/* import fetch from "node-fetch"; */

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
// OPENROUTER AI (ARREGLADO)
// =====================

async function longcatAI(message, userId) {
  const API = process.env.OPENROUTER_API;

  if (!API) {
    console.log("⚠️ FALTA OPENROUTER_API");
    return "Nanachi no tiene energía...";
  }

  const history = memory.get(userId) ?? [];

  history.push({
    role: "user",
    content: message
  });

  let timeout;

  try {
    console.log("📡 Enviando a OpenRouter...");

    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 15000);

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
            { role: "system", content: NANACHI_PROMPT },
            ...history
          ]
        }),
        signal: controller.signal
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.log("❌ ERROR HTTP:", res.status, errText);
      return "Nanachi no pudo responder...";
    }

    const text = await res.text();
    console.log("📦 RAW:", text);

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return "Nanachi no entendió la respuesta...";
    }

    let reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      return "Nanachi se queda pensando...";
    }

    reply = cleanReply(limitReply(reply));

    history.push({
      role: "assistant",
      content: reply
    });

    memory.set(userId, history.slice(-8));

    return reply;

  } catch (err) {
    console.log("❌ ERROR:", err);

    if (err.name === "AbortError") {
      return "Nanachi se distrajo...";
    }

    return "Nanachi guarda silencio...";
  } finally {
    clearTimeout(timeout);
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
// ANTI-CRASH GLOBAL
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
