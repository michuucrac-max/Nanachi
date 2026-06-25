// =====================
// NANACHI AI BOT
// PARTE 1
// =====================

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType
} from "discord.js";

import fetch from "node-fetch";
import http from "http";
import fs from "fs";

// =====================
// ENV
// =====================

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

// =====================
// NANACHI.TXT
// =====================

let NANACHI_PROMPT = `
Eres Nanachi.
`;

try {

  const txt = fs.readFileSync(
    "nanachi.txt",
    "utf8"
  );

  if (txt.trim()) {
    NANACHI_PROMPT = txt;
  }

  console.log(
    "✅ nanachi.txt cargado"
  );

} catch (err) {

  console.log(
    "⚠️ nanachi.txt no encontrado"
  );
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

// =====================
// MEMORIA
// =====================

const activeChats = new Map();

const memories = new Map();

function addMemory(
  userId,
  role,
  content
) {

  const history =
    memories.get(userId) || [];

  history.push({
    role,
    content
  });

  while (
    history.length > 20
  ) {
    history.shift();
  }

  memories.set(
    userId,
    history
  );
}

function buildHistory(
  userId
) {

  const history =
    memories.get(userId) || [];

  return history
    .map(
      entry =>
        `${
          entry.role === "user"
            ? "Usuario"
            : "Nanachi"
        }: ${entry.content}`
    )
    .join("\n");
}

// =====================
// ESTADOS ROTATORIOS
// =====================

const statuses = [

  "Explorando el Abismo",

  "Observando reliquias",

  "Pensando en Mitty",

  "Ayudando a Reg",

  "n!help",

  "Hablando con Cave Raiders",

  "Buscando tesoros",

  "Estudiando artefactos"

];

// =====================
// GEMINI
// =====================

async function askGemini(
  userId,
  message
) {

  if (!GEMINI_API) {
    throw new Error(
      "GEMINI_API no configurada"
    );
  }

  const historyText =
    buildHistory(userId);

  const prompt = `
${NANACHI_PROMPT}

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
        "Content-Type":
          "application/json"
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

  const raw =
    await res.text();

  console.log(
    "📡 GEMINI STATUS:",
    res.status
  );

  // Cuota agotada
  if (res.status === 429) {
    return null;
  }

  if (!res.ok) {

    throw new Error(
      raw.slice(0, 1000)
    );
  }

  const data =
    JSON.parse(raw);

  const reply =
    data?.candidates?.[0]
      ?.content?.parts?.[0]
      ?.text;

  if (!reply) {

    throw new Error(
      "Gemini respondió vacío"
    );
  }

  addMemory(
    userId,
    "user",
    message
  );

  addMemory(
    userId,
    "assistant",
    reply
  );

  return reply;
}

// =====================
// READY
// =====================

client.once(
  Events.ClientReady,
  () => {

    console.log(
      `✅ Conectada como ${client.user.tag}`
    );

    let index = 0;

    client.user.setActivity(
      statuses[0],
      {
        type:
          ActivityType.Playing
      }
    );

    setInterval(() => {

      index++;

      if (
        index >=
        statuses.length
      ) {
        index = 0;
      }

      client.user.setActivity(
        statuses[index],
        {
          type:
            ActivityType.Playing
        }
      );

    }, 30000);

  }
);

// =====================
// NANACHI AI BOT
// PARTE 2
// =====================

client.on(
  Events.MessageCreate,
  async message => {

    try {

      if (
        message.author.bot
      ) return;

      const isDM =
        !message.guild;

      const trigger =
        /\b(nana|nanachi)\b/i;

      // =====================
      // MENSAJES DEL SERVIDOR
      // =====================

      if (
        !isDM &&
        trigger.test(
          message.content
        )
      ) {

        activeChats.set(
          message.author.id,
          {
            channelId:
              message.channel.id,
            guildId:
              message.guild.id
          }
        );

        const owner =
          await client.users.fetch(
            OWNER_ID
          );

        // Copia al DM

        try {

          await owner.send(
            `📩 Conversación\n\n` +
            `👤 Usuario: ${message.author.tag}\n` +
            `🆔 ID: ${message.author.id}\n` +
            `🏠 Servidor: ${message.guild.name}\n` +
            `💬 Canal: #${message.channel.name}\n\n` +
            `📨 Mensaje:\n${message.content}`
          );

        } catch (
          dmError
        ) {

          console.log(
            "⚠️ No pude enviar DM:",
            dmError.message
          );
        }

        await message.channel.sendTyping();

        try {

          const reply =
            await askGemini(
              message.author.id,
              message.content
            );

          // Gemini sin cuota

          if (
            reply === null
          ) {

            try {

              await owner.send(
                `⚠️ Gemini sin cuota.\n\n` +
                `👤 ${message.author.tag}\n` +
                `🆔 ${message.author.id}\n\n` +
                `${message.content}`
              );

            } catch {}

            await message.reply(
              "Nanachi está algo cansada ahora mismo..."
            );

            return;
          }

          // Limitar respuesta

          const safeReply =
            reply.length > 1900
              ? reply.slice(
                  0,
                  1900
                )
              : reply;

          await message.reply(
            safeReply
          );

        } catch (err) {

          console.error(
            "❌ GEMINI ERROR:",
            err
          );

          const errorText =
            String(
              err.message
            ).slice(
              0,
              1000
            );

          try {

            await owner.send(
              `⚠️ Error Gemini\n\n${errorText}`
            );

          } catch {}

          await message.reply(
            "Nanachi se quedó pensando..."
          );
        }
      }

      // =====================
      // N!WRITE
      // =====================

      if (
        isDM &&
        message.author.id ===
          OWNER_ID &&
        message.content.startsWith(
          "n!write"
        )
      ) {

        const args =
          message.content.split(
            " "
          );

        if (
          args.length < 3
        ) {

          return message.reply(
            "Uso: n!write userID mensaje"
          );
        }

        const userId =
          args[1];

        const text =
          args
            .slice(2)
            .join(" ");

        const chat =
          activeChats.get(
            userId
          );

        if (!chat) {

          return message.reply(
            "❌ No hay conversación activa con ese usuario."
          );
        }

        try {

          const channel =
            await client.channels.fetch(
              chat.channelId
            );

          if (
            !channel
          ) {

            return message.reply(
              "❌ Canal no encontrado."
            );
          }

          await channel.send(
            text
          );

          addMemory(
            userId,
            "assistant",
            text
          );

          await message.reply(
            "✅ Respuesta enviada."
          );

        } catch (
          sendError
        ) {

          console.error(
            "❌ ERROR N!WRITE:",
            sendError
          );

          await message.reply(
            "❌ Error enviando mensaje."
          );
        }
      }

    } catch (err) {

      console.error(
        "💥 ERROR GENERAL:",
        err
      );
    }
  }
);

// =====================
// KEEP ALIVE
// =====================

http
  .createServer(
    (_, res) => {

      res.writeHead(200);

      res.end(
        "Nanachi viva 🐇"
      );
    }
  )
  .listen(
    process.env.PORT ||
      3000
  );

// =====================
// ANTI CRASH
// =====================

process.on(
  "uncaughtException",
  err => {

    console.error(
      "💥 ERROR GLOBAL:",
      err
    );
  }
);

process.on(
  "unhandledRejection",
  err => {

    console.error(
      "💥 PROMISE ERROR:",
      err
    );
  }
);

// =====================
// LOGIN
// =====================

client.login(
  TOKEN
);
