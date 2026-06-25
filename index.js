import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType
} from "discord.js";

import fetch from "node-fetch";
import http from "http";
import fs from "fs";

// =====================
// ENV
// =====================

const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

if (!TOKEN || !OWNER_ID || !CEREBRAS_API_KEY) {
  console.error("❌ Faltan variables de entorno");
  process.exit(1);
}

// =====================
// PROMPT
// =====================

let NANACHI_PROMPT = "Eres Nanachi.";

try {
  const txt = fs.readFileSync("nanachi.txt", "utf8");
  if (txt.trim()) NANACHI_PROMPT = txt;
  console.log("✅ Prompt cargado");
} catch {
  console.log("⚠️ Prompt por defecto");
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
// MEMORIA OPTIMIZADA
// =====================

const memories = new Map();
const MAX_MEMORY = 8;

function addMemory(userId, role, content) {
  if (!content || content.length < 2) return;

  const history = memories.get(userId) || [];

  history.push({ role, content });

  while (history.length > MAX_MEMORY) {
    history.shift();
  }

  memories.set(userId, history);
}

// =====================
// ESTADOS
// =====================

const statuses = [
  "Explorando el Abismo",
  "Observando reliquias",
  "Pensando en Mitty",
  "Ayudando a Reg",
  "Buscando tesoros",
  "Estudiando artefactos",
  "nnaaa",
  "cuanto extraño a mi familia",
  "el abismo no perdona las malas desiciones",
  "cuanto odio a bondreowd",
  "solo debo bajar mas",
  "familia...",
  "quisiera recuperar mi infancia",
  "no es ilegal?",
  "¡oye que estas mirando!",
  "los odio los odio los odio los odio los odio!",
  "no soy un juguete",
  "oh mitty...",
  "chocolate?",
  "adoro el chocolate!"
];

// =====================
// LOG LIMPIO
// =====================

function log(type, msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${type} → ${msg}`);
}

// =====================
// IA OPTIMIZADA (BALANCE COSTO + CALIDAD)
// =====================

async function askCerebras(userId, message) {
  const history = memories.get(userId) || [];
  const trimmed = history.slice(-6);

  // 🔥 TOKENS DINÁMICOS (CLAVE)
  const len = message.length;

  let max_tokens = 250;

  if (len > 60) max_tokens = 300;
  if (len > 120) max_tokens = 400;
  if (len > 200) max_tokens = 500;

  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CEREBRAS_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-oss-120b",

      messages: [
        { role: "system", content: NANACHI_PROMPT },
        ...trimmed,
        { role: "user", content: message }
      ],

      max_tokens,
      temperature: 0.8
    })
  });

  const data = await response.json();

  if (!response.ok) {
    log("ERROR IA", JSON.stringify(data).slice(0, 200));
    throw new Error("Error Cerebras");
  }

  const reply = data?.choices?.[0]?.message?.content;

  if (!reply) throw new Error("Respuesta vacía");

  addMemory(userId, "user", message);
  addMemory(userId, "assistant", reply);

  return reply;
}

// =====================
// READY
// =====================

client.once(Events.ClientReady, () => {
  log("BOT", `Conectado como ${client.user.tag}`);

  let i = 0;

  client.user.setActivity(statuses[0], {
    type: ActivityType.Playing
  });

  setInterval(() => {
    i = (i + 1) % statuses.length;

    client.user.setActivity(statuses[i], {
      type: ActivityType.Playing
    });
  }, 30000);
});

// =====================
// MESSAGE HANDLER
// =====================

client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;

    const isDM = !message.guild;
    const trigger = /\b(nana|nanachi)\b/i;

    // =====================
    // SERVIDOR
    // =====================

    if (!isDM && trigger.test(message.content)) {
      log("TRIGGER", `${message.author.tag}`);

      await message.channel.sendTyping();

      try {
        const reply = await askCerebras(
          message.author.id,
          message.content
        );

        await message.reply(
          reply.length > 1900 ? reply.slice(0, 1900) : reply
        );

      } catch (err) {
        log("IA ERROR", err.message);
        await message.reply("Nanachi está pensando...");
      }
    }

    // =====================
    // OWNER CONTROL (SIN SPAM MD)
    // =====================

    if (isDM && message.author.id === OWNER_ID) {
      if (!message.content.startsWith("n!write")) return;

      const args = message.content.split(" ");
      if (args.length < 3) {
        return message.reply("Uso: n!write userId mensaje");
      }

      const userId = args[1];
      const text = args.slice(2).join(" ");

      try {
        const channel = message.channel;

        await channel.send(text);

        addMemory(userId, "assistant", text);

        log("WRITE", `Mensaje enviado a ${userId}`);

        await message.reply("✅ Enviado");

      } catch (err) {
        log("WRITE ERROR", err.message);
        await message.reply("❌ Error");
      }
    }

  } catch (err) {
    log("FATAL", err.message);
  }
});

// =====================
// KEEP ALIVE
// =====================

http.createServer((_, res) => {
  res.writeHead(200);
  res.end("Nanachi alive");
}).listen(process.env.PORT || 3000);

// =====================
// ERRORS
// =====================

process.on("uncaughtException", (err) => {
  log("CRASH", err.message);
});

process.on("unhandledRejection", (err) => {
  log("PROMISE", err.message);
});

// =====================
// LOGIN
// =====================

client.login(TOKEN);
