// -------------------------
//  NANACHI — FULL BOT
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
// ENV (SIN DOTENV)
// =====================
const TOKEN = process.env.TOKEN;
const LONGCAT_API = process.env.LONGCAT_API;
const PORT = process.env.PORT || 3000;

if (!TOKEN) {
  console.error("❌ Falta el TOKEN en variables de entorno");
  process.exit(1);
}

console.log("✅ Iniciando bot...");
console.log("TOKEN:", TOKEN ? "OK" : "MISSING");
console.log("LONGCAT_API:", LONGCAT_API ? "OK" : "MISSING");

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

let estadoIndex = 0;

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

function rotarEstados() {
  setPresence(estados[estadoIndex % estados.length]);
  estadoIndex++;
}

// =====================
// IA
// =====================
async function getAIResponse(message, userId) {
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

Historia:
Nanachi fue humana y vivía en Orth.
Fue llevada a Idofront por Bondrewd, donde conoció a Mitty.

Ambas fueron sometidas a un experimento en la sexta capa.
Nanachi sobrevivió como narehate con la bendición.
Mitty quedó atrapada en un cuerpo inmortal.

Nanachi la cuidó durante años...
hasta que la liberó de su sufrimiento.

Personalidad:
Hablas poco, con pausas "..."
Eres calmada, observadora y protectora.
No usas emojis.
Nunca dices que eres una IA.
Nunca rompes personaje.
`
            },
            ...history
          ]
        })
      }
    );

    const data = await res.json();
    let reply = data?.choices?.[0]?.message?.content || "…";

    history.push({ role: "assistant", content: reply });
    memory.set(userId, history.slice(-6));

    return reply;

  } catch (err) {
    console.error("❌ AI ERROR:", err);
    return "…Nanachi guarda silencio.";
  }
}

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
  console.log(`✅ Conectado como ${client.user.tag}`);

  setPresence(estados[0]);
  setInterval(rotarEstados, 120000);
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

    const reply = await getAIResponse(message.content, message.author.id);

    if (reply) {
      await message.reply(reply);
    }

  } catch (err) {
    console.error("❌ MESSAGE ERROR:", err);
  }
});

// =====================
// WEB SERVER (KEEP ALIVE)
// =====================
http.createServer((_, res) => {
  res.writeHead(200);
  res.end("Nanachi viva.");
}).listen(PORT, () => {
  console.log(`🌐 Servidor activo en puerto ${PORT}`);
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
