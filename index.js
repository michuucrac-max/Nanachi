// ================================
// NANACHI — MODERN BOT (2026)
// ================================

// 🔥 FIX RED (IMPORTANTE)
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
  console.error("❌ TOKEN faltante");
  process.exit(1);
}

console.log("🔵 Iniciando Nanachi...");

// =====================
// CLIENT (ACTUALIZADO)
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  presence: {
    status: "online",
    activities: [{ name: "Despertando...", type: ActivityType.Playing }]
  }
});

// =====================
// DEBUG GATEWAY (NUEVO)
// =====================
client.on("debug", msg => console.log("📡", msg));
client.on("error", err => console.error("❌ CLIENT:", err));
client.on("shardError", err => console.error("❌ SHARD:", err));
client.on("shardDisconnect", () => console.warn("⚠️ Desconectado del gateway"));
client.on("shardReconnecting", () => console.log("🔄 Reintentando conexión..."));

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

let i = 0;

function rotarEstado() {
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
// IA
// =====================
async function getAI(msg, userId) {
  if (!LONGCAT_API) return "…";

  const hist = memory.get(userId) ?? [];
  hist.push({ role: "user", content: msg });

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
              content: "Eres Nanachi. Hablas poco, con pausas..."
            },
            ...hist
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

    hist.push({ role: "assistant", content: reply });
    memory.set(userId, hist.slice(-6));

    return reply;

  } catch (err) {
    console.error("❌ IA:", err);
    return "…Nanachi guarda silencio.";
  }
}

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
  console.log("✅ CONECTADO COMO:", client.user.tag);

  rotarEstado();
  setInterval(rotarEstado, 120000);
});

// =====================
// MENSAJES
// =====================
client.on(Events.MessageCreate, async msg => {
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
    console.error("❌ MSG:", err);
  }
});

// =====================
// KEEP ALIVE
// =====================
http.createServer((_, res) => {
  res.end("Nanachi activa");
}).listen(PORT, () => {
  console.log("🌐 Web activa en", PORT);
});

// =====================
// LOGIN (MEJORADO)
// =====================
async function start() {
  try {
    console.log("🔵 Conectando a Discord...");
    await client.login(TOKEN);
    console.log("🟢 Login completado");
  } catch (err) {
    console.error("🔴 Login falló:", err);
    setTimeout(start, 5000); // 🔄 retry automático
  }
}

start();
