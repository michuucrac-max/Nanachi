// =====================
// IMPORTS (IGUAL QUE EL BOT QUE FUNCIONA)
// =====================
import {
  Client,
  GatewayIntentBits,
  Partials,
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

// =====================
// EXPRESS (CLAVE)
// =====================
const app = express();
app.get("/", (_, res) => res.send("Nanachi observa el Abismo…"));
app.listen(PORT, () => console.log(`🌐 Express activo en ${PORT}`));

// =====================
// CLIENT (MISMA CONFIG QUE FUNCIONA)
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
// IA (MISMA LÓGICA PERO LIMPIA)
// =====================
async function getAI(msg, userId) {
  if (!LONGCAT_API) return "…";

  const history = memory.get(userId) ?? [];
  history.push({ role: "user", content: msg });

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
  console.log(`🟢 Nanachi despierta como ${client.user.tag}`);

  setEstado();
  setInterval(setEstado, 120000);
});

// =====================
// MENSAJES (MODO ACTIVO)
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

    if (reply) {
      await message.reply(reply);
    }

  } catch (err) {
    console.error("❌ MSG ERROR:", err);
  }
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
