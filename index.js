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

if (!TOKEN) {
  console.error("❌ TOKEN no encontrado en Render env");
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
// MEMORIA
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

let i = 0;

function presence() {
  if (!client.user) return;

  client.user.setPresence({
    status: "online",
    activities: [{
      name: estados[i % estados.length],
      type: ActivityType.Playing
    }]
  });

  i++;
}

// =====================
// FETCH SAFE (IMPORTANTE)
// =====================
async function safeFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

// =====================
// IA
// =====================
async function getAI(msg, id) {
  if (!LONGCAT_API) return "…";

  const hist = memory.get(id) ?? [];
  hist.push({ role: "user", content: msg });

  try {
    const data = await safeFetch(
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
              content: "Eres Nanachi de Made in Abyss..."
            },
            ...hist
          ]
        })
      }
    );

    const reply = data?.choices?.[0]?.message?.content || "…";

    hist.push({ role: "assistant", content: reply });
    memory.set(id, hist.slice(-6));

    return reply;

  } catch (err) {
    console.error("❌ IA ERROR:", err);
    return "…";
  }
}

// =====================
// READY (CRÍTICO)
// =====================
client.once(Events.ClientReady, () => {
  console.log("🔥 CONECTADO COMO:", client.user.tag);

  presence();
  setInterval(presence, 120000);
});

// =====================
// MENSAJES
// =====================
client.on(Events.MessageCreate, async message => {
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
    console.error("❌ MSG ERROR:", err);
  }
});

// =====================
// KEEP ALIVE RENDER
// =====================
http.createServer((_, res) => {
  res.writeHead(200);
  res.end("Nanachi activa");
}).listen(PORT, () => {
  console.log("🌐 Server en puerto", PORT);
});

// =====================
// LOGIN (CRÍTICO)
// =====================
client.login(TOKEN).catch(err => {
  console.error("❌ LOGIN ERROR:", err);
});
