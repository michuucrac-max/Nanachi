// ================================
// NANACHI — IA SIMPLE Y ESTABLE
// ================================

// 🔥 FIX RED (IMPORTANTE EN RENDER)
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType
} from "discord.js";

import http from "http";

// =====================
// ENV
// =====================
const TOKEN = process.env.TOKEN;
const LONGCAT_API = process.env.LONGCAT_API;
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
  console.error("❌ Falta TOKEN");
  process.exit(1);
}

console.log("🔵 Iniciando Nanachi...");

// =====================
// CLIENT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
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

let estadoIndex = 0;

function setEstado() {
  if (!client.user) return;

  client.user.setPresence({
    status: "online",
    activities: [{
      name: estados[estadoIndex % estados.length],
      type: ActivityType.Playing
    }]
  });

  estadoIndex++;
}

// =====================
// IA
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
Hablas poco, con pausas "..."
Eres calmada y observadora.
Nunca dices que eres IA.
`
            },
            ...history
          ]
        })
      }
    );

    if (!res.ok) {
      console.error("❌ API:", res.status);
      return "…";
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || "…";

    history.push({ role: "assistant", content: reply });
    memory.set(userId, history.slice(-6));

    return reply;

  } catch (err) {
    console.error("❌ IA ERROR:", err);
    return "…Nanachi guarda silencio.";
  }
}

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
  console.log("✅ Conectado como", client.user.tag);

  setEstado();
  setInterval(setEstado, 120000);
});

// =====================
// MENSAJES (MODO ACTIVO)
// =====================
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (msg.author.bot) return;

    const now = Date.now();
    const last = cooldown.get(msg.author.id) || 0;

    if (now - last < 4000) return;
    cooldown.set(msg.author.id, now);

    await msg.channel.sendTyping();

    const reply = await getAI(msg.content, msg.author.id);

    if (reply) {
      await msg.reply(reply);
    }

  } catch (err) {
    console.error("❌ MSG ERROR:", err);
  }
});

// =====================
// KEEP ALIVE
// =====================
http.createServer((_, res) => {
  res.end("Nanachi viva");
}).listen(PORT, () => {
  console.log("🌐 Web activa en puerto", PORT);
});

// =====================
// LOGIN
// =====================
console.log("🔵 Login...");

client.login(TOKEN)
  .then(() => console.log("🟢 Login OK"))
  .catch(err => console.error("🔴 Login error:", err));
