// -------------------------
//  NANACHI — BOT FUNCIONAL
// -------------------------

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType
} from "discord.js";

import http from "http";

// =====================
// ENV (RENDER)
// =====================
const TOKEN = process.env.TOKEN;
const LONGCAT_API = process.env.LONGCAT_API;
const PORT = process.env.PORT || 3000;

console.log("🔵 Iniciando bot...");
console.log("TOKEN:", TOKEN ? "OK" : "MISSING");
console.log("LONGCAT_API:", LONGCAT_API ? "OK" : "MISSING");

if (!TOKEN) {
  console.error("❌ TOKEN no encontrado en variables de entorno");
  process.exit(1);
}

// =====================
// CLIENT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// =====================
// MEMORIA + COOLDOWN
// =====================
const memory = new Map();
const cooldown = new Map();

// =====================
// ESTADOS
// =====================
const estados = [
  "Observando el Abismo…",
  "Escuchando el silencio…",
  "Cuidando lo que queda…"
];

let index = 0;

function setPresence() {
  if (!client.user) return;

  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: estados[index % estados.length],
        type: ActivityType.Playing
      }
    ]
  });

  index++;
}

// =====================
// IA (SAFE FETCH)
// =====================
async function getAI(message, userId) {
  if (!LONGCAT_API) return "…";

  const history = memory.get(userId) ?? [];
  history.push({ role: "user", content: message });

  try {
    const res = await fetch(
      "https://api.longcat.chat/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LONGCAT_API}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "LongCat-Flash-Chat",
          messages: [
            {
              role: "system",
              content: `
Eres Nanachi de Made in Abyss.
Hablas lento, con pausas.
No usas emojis.
No dices que eres IA.
`
            },
            ...history
          ]
        })
      }
    );

    if (!res.ok) {
      console.error("❌ API ERROR:", res.status);
      return "…";
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || "…";

    history.push({ role: "assistant", content: reply });
    memory.set(userId, history.slice(-6));

    return reply;

  } catch (err) {
    console.error("❌ IA ERROR:", err);
    return "…";
  }
}

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
  console.log("🔥 CONECTADO COMO:", client.user.tag);

  setPresence();
  setInterval(setPresence, 120000);
});

// =====================
// MENSAJES
// =====================
client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;

    const now = Date.now();
    const last = cooldown.get(message.author.id) || 0;

    if (now - last < 4000) return;
    cooldown.set(message.author.id, now);

    await message.channel.sendTyping();

    const reply = await getAI(message.content, message.author.id);

    await message.reply(reply);

  } catch (err) {
    console.error("❌ MESSAGE ERROR:", err);
  }
});

// =====================
// KEEP ALIVE (RENDER)
// =====================
http.createServer((_, res) => {
  res.writeHead(200);
  res.end("Nanachi activa");
}).listen(PORT, () => {
  console.log("🌐 Server listo en puerto", PORT);
});

// =====================
// LOGIN (CRÍTICO)
// =====================
console.log("🔵 Intentando login...");

client.login(TOKEN)
  .then(() => console.log("🟢 LOGIN EXITOSO"))
  .catch((err) => {
    console.error("🔴 LOGIN FALLÓ:", err);
  });
