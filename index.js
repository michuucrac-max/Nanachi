// =====================
// NANACHI AI BOT
// PARTE 1
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

  while (history.length > 20) {
    history.shift();
  }

  memories.set(userId, history);
}

function buildHistory(userId) {
  const history = memories.get(userId) || [];

  return history
    .map(entry =>
      `${entry.role === "user" ? "Usuario" : "Nanachi"}: ${entry.content}`
    )
    .join("\n");
}

async function askGemini(userId, message) {

  if (!GEMINI_API) {
    throw new Error("GEMINI_API no configurada");
  }

  const historyText = buildHistory(userId);

  const prompt = `
Eres Nanachi de Made in Abyss.

Personalidad:
- Inteligente
- Sarcástica
- Tranquila
- Natural
- No repites frases

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

  const raw = await res.text();

  console.log("📡 GEMINI STATUS:", res.status);

  if (res.status === 429) {
    return null;
  }

  if (!res.ok) {
    throw new Error(
      raw.slice(0, 1000)
    );
  }

  const data = JSON.parse(raw);

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
  console.log(
    `✅ Conectada como ${client.user.tag}`
  );
});

// =====================
// NANACHI AI BOT
// PARTE 2
// =====================

client.on(Events.MessageCreate, async message => {

  try {

    if (message.author.bot) return;

    const isDM = !message.guild;

    const trigger =
      /\b(nana|nanachi)\b/i;

    // =====================
    // MENSAJES DEL SERVIDOR
    // =====================

    if (!isDM && trigger.test(message.content)) {

      activeChats.set(
        message.author.id,
        {
          channelId: message.channel.id,
          guildId: message.guild.id
        }
      );

      const owner =
        await client.users.fetch(
          OWNER_ID
        );

      // Siempre copia al DM
      await owner.send(
        `📩 Conversación\n\n` +
        `👤 ${message.author.tag}\n` +
        `🆔 ${message.author.id}\n` +
        `💬 ${message.content}`
      );

      await message.channel.sendTyping();

      try {

        const reply =
          await askGemini(
            message.author.id,
            message.content
          );

        // Cuota agotada
        if (reply === null) {

          await owner.send(
            `⚠️ Gemini sin cuota.\n\n` +
            `Usuario: ${message.author.tag}\n` +
            `ID: ${message.author.id}`
          );

          await message.reply(
            "Nanachi está ocupada ahora mismo..."
          );

          return;
        }

        await message.reply(reply);

      } catch (err) {

        console.error(
          "❌ GEMINI ERROR:",
          err
        );

        const errorText =
          String(err.message)
            .slice(0, 1000);

        await owner.send(
          `⚠️ Error Gemini\n\n${errorText}`
        );

        await message.reply(
          "Nanachi se quedó pensando..."
        );
      }
    }

    // =====================
    // RESPUESTA MANUAL
    // =====================

    if (
      isDM &&
      message.author.id === OWNER_ID &&
      message.content.startsWith(
        "n!write"
      )
    ) {

      const args =
        message.content.split(" ");

      if (args.length < 3) {
        return message.reply(
          "Uso: n!write userID mensaje"
        );
      }

      const userId = args[1];

      const text =
        args.slice(2).join(" ");

      const chat =
        activeChats.get(userId);

      if (!chat) {

        return message.reply(
          "❌ Conversación no encontrada"
        );
      }

      const channel =
        await client.channels.fetch(
          chat.channelId
        );

      if (!channel) {

        return message.reply(
          "❌ Canal no encontrado"
        );
      }

      await channel.send(text);

      addMemory(
        userId,
        "assistant",
        text
      );

      await message.reply(
        "✅ Mensaje enviado"
      );
    }

  } catch (err) {

    console.error(
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
  .listen(
    process.env.PORT || 3000
  );

// =====================
// LOGIN
// =====================

client.login(TOKEN);
