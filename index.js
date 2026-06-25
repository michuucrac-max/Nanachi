// =====================
// NANACHI AI BOT
// =====================

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events
} from "discord.js";

import fetch from "node-fetch";
import http from "http";

const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;
const GEMINI_API = process.env.GEMINI_API;

if (!TOKEN) {
  console.error("❌ Falta TOKEN");
  process.exit(1);
}

if (!OWNER_ID) {
  console.error("❌ Falta OWNER_ID");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const activeChats = new Map();

const memories = new Map();

function addMemory(userId, role, content) {
  const history = memories.get(userId) || [];

  history.push({
    role,
    content
  });

  if (history.length > 20) {
    history.shift();
  }

  memories.set(userId, history);
}

function buildHistory(userId) {
  const history = memories.get(userId) || [];

  return history
    .map(x =>
      `${x.role === "user" ? "Usuario" : "Nanachi"}: ${x.content}`
    )
    .join("\n");
}

async function askGemini(userId, message) {

  const historyText = buildHistory(userId);

  const prompt = `
Eres Nanachi de Made in Abyss.

Personalidad:
- Inteligente
- Sarcástica
- Tranquila
- Amable con amigos
- Respuestas naturales

Historial:
${historyText}

Usuario: ${message}
Nanachi:
`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    }
  );

  const text = await res.text();

  console.log("📡 Gemini:", res.status);

  if (!res.ok) {
    throw new Error(text);
  }

  const data = JSON.parse(text);

  const reply =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!reply) {
    throw new Error("Gemini respondió vacío");
  }

  addMemory(userId, "user", message);
  addMemory(userId, "assistant", reply);

  return reply;
}

client.once(Events.ClientReady, () => {
  console.log(`✅ Conectada como ${client.user.tag}`);
});

// =====================
// NANACHI AI BOT
// PARTE 2
// =====================

client.on(Events.MessageCreate, async message => {

  try {

    if (message.author.bot) return;

    const isDM = !message.guild;

    const trigger = /\b(nana|nanachi)\b/i;

    // =====================
    // MENSAJES DEL SERVIDOR
    // =====================

    if (!isDM && trigger.test(message.content)) {

      activeChats.set(message.author.id, {
        channelId: message.channel.id,
        guildId: message.guild.id
      });

      await message.channel.sendTyping();

      try {

        const reply = await askGemini(
          message.author.id,
          message.content
        );

        await message.reply(reply);

        const owner = await client.users.fetch(
          OWNER_ID
        );

        await owner.send(
          `📩 Conversación\n\n` +
          `👤 ${message.author.tag}\n` +
          `🆔 ${message.author.id}\n` +
          `💬 ${message.content}\n\n` +
          `🤖 ${reply}`
        );

      } catch (err) {

        console.log("❌ GEMINI:", err);

        const owner = await client.users.fetch(
          OWNER_ID
        );

        await owner.send(
          `⚠️ Error Gemini\n\n` +
          `Usuario: ${message.author.tag}\n` +
          `ID: ${message.author.id}\n\n` +
          `${message.content}\n\n` +
          `${err.message}`
        );

        await message.reply(
          "Nanachi se quedó pensando..."
        );
      }
    }

    // =====================
    // COMANDO MANUAL
    // =====================

    if (
      isDM &&
      message.author.id === OWNER_ID &&
      message.content.startsWith("n!write")
    ) {

      const args = message.content.split(" ");

      if (args.length < 3) {
        return message.reply(
          "Uso: n!write userID mensaje"
        );
      }

      const userId = args[1];

      const text = args.slice(2).join(" ");

      const chat = activeChats.get(userId);

      if (!chat) {
        return message.reply(
          "❌ Conversación no encontrada"
        );
      }

      const channel = await client.channels.fetch(
        chat.channelId
      );

      if (!channel) {
        return message.reply(
          "❌ Canal no encontrado"
        );
      }

      await channel.send(text);

      addMemory(userId, "assistant", text);

      await message.reply(
        "✅ Mensaje enviado"
      );
    }

  } catch (err) {

    console.log(
      "💥 ERROR GENERAL:",
      err
    );
  }
});

// =====================
// KEEP ALIVE
// =====================

http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("Nanachi viva");
  })
  .listen(process.env.PORT || 3000);

// =====================
// LOGIN
// =====================

client.login(TOKEN);
