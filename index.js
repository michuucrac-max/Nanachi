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
// GROQ AI (ARREGLADO)
// =====================

async function longcatAI(message, userId) {
  const GROQ_API = process.env.GROQ_API;

  if (!GROQ_API) {
    throw new Error("FALTA GROQ_API");
  }

  const history = memory.get(userId) ?? [];

  history.push({
    role: "user",
    content: message
  });

  try {
    console.log("📡 Enviando a Groq...");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s

    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
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

    console.log("✅ Respuesta recibida:", res.status);

    // 🔴 ERROR HTTP
    if (!res.ok) {
      const errText = await res.text();
      console.log("❌ ERROR HTTP:", res.status, errText);
      throw new Error(`HTTP ${res.status}`);
    }

    // 🧠 Leer como texto primero
    const text = await res.text();
    console.log("📦 RAW RESPONSE:", text);

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Respuesta no es JSON válido");
    }

    let reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("Respuesta vacía");
    }

    reply = cleanReply(limitReply(reply));

    history.push({
      role: "assistant",
      content: reply
    });

    memory.set(userId, history.slice(-8));

    return reply;

  } catch (err) {
    console.log("❌ ERROR GROQ:", err);

    // ⏳ Timeout detectado
    if (err.name === "AbortError") {
      return "Nanachi se distrajo... (timeout)";
    }

    // 📩 DM con error
    try {
      const user = await client.users.fetch("1427297946151551148");

      await user.send(
        "⚠️ ERROR EN NANACHI\n\n```" + err.message + "```"
      );
    } catch (e) {
      console.log("No se pudo enviar DM:", e);
    }

    return "Nanachi se queda en silencio...";
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
