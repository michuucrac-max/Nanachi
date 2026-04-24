// ================================
// NANACHI — IA FIX RENDER
// ================================

import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType
} from "discord.js";

import express from "express";

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

// =====================
// EXPRESS (CLAVE)
// =====================
const app = express();

app.get("/", (_, res) => {
  res.send("Nanachi viva...");
});

app.listen(PORT, () => {
  console.log("🌐 Express activo en", PORT);
});

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

let i = 0;

function estado() {
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
async function getAI(msg, id) {
  if (!LONGCAT_API) return "…";

  const hist = memory.get(id) ?? [];
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

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || "…";

    hist.push({ role: "assistant", content: reply });
    memory.set(id, hist.slice(-6));

    return reply;

  } catch {
    return "…";
  }
}

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
  console.log("✅ Conectado como", client.user.tag);

  estado();
  setInterval(estado, 120000);
});

// =====================
// MENSAJES
// =====================
client.on(Events.MessageCreate, async msg => {
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
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
