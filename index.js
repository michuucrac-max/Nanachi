// -------------------------
//  NANACHI — INDEX.JS FINAL
// -------------------------

import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  Events,
  ActivityType
} from "discord.js";

import fs from "fs";
import fetch from "node-fetch";
import http from "http";
import "dotenv/config";

// =====================
// ENV
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const LONGCAT_API = process.env.LONGCAT_API;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Faltan variables de entorno");
  process.exit(1);
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
// PRESENCIA
// =====================
function setPresence(text) {
  if (!client.user) return;

  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: text,
        type: ActivityType.Playing
      }
    ]
  });
}

// =====================
// LONGCAT AI
// =====================
async function longcatAI(message, userId) {
  if (!LONGCAT_API) return "…Nanachi te escucha.";

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

Historia:
Nanachi fue una niña humana que vivía en Orth, fascinada por el Abismo.
Fue llevada por Bondrewd a Idofront, donde conoció a Mitty.
Ambas fueron sometidas a un experimento en la sexta capa.

Nanachi sobrevivió como narehate con la bendición del Abismo.
Mitty quedó atrapada en un cuerpo inmortal, sufriendo eternamente.

Nanachi dedicó su vida a cuidarla…
hasta que tomó la decisión más dolorosa: liberarla de su sufrimiento.

Personalidad:
Hablas con frases cortas, pausadas.
Eres empática, observadora, protectora.
No hablas de más. No usas emojis.
A veces usas "..." para marcar silencios.

Nunca rompes el personaje.
Nunca dices que eres una IA.
`
            },
            ...history
          ]
        })
      }
    );

    const data = await res.json();
    let reply = data?.choices?.[0]?.message?.content;
    if (!reply) throw new Error();

    history.push({ role: "assistant", content: reply });
    memory.set(userId, history.slice(-8));

    return reply;
  } catch {
    return "…Nanachi guarda silencio.";
  }
}

// =====================
// READY
// =====================
client.once(Events.ClientReady, async () => {
  console.log(`✅ Nanachi conectada como ${client.user.tag}`);
  setPresence("Observando el Abismo…");
});

// =====================
// MENSAJES
// =====================
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  if (!/\b(nanachi|nana)\b/i.test(message.content)) return;

  const now = Date.now();
  const last = lastReply.get(message.author.id) ?? 0;
  if (now - last < 3000) return;
  lastReply.set(message.author.id, now);

  await message.channel.sendTyping();

  const reply = await longcatAI(message.content, message.author.id);
  if (!reply) return;

  await message.reply(reply);
});

// =====================
// WEB
// =====================
http.createServer((_, res) => {
  res.writeHead(200);
  res.end("Nanachi viva.");
}).listen(process.env.PORT || 3000);

// =====================
// LOGIN
// =====================
client.login(TOKEN);
