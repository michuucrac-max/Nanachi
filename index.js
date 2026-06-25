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
const GROQ_API = process.env.GROQ_API;

if (!TOKEN) {
  console.error("❌ Falta TOKEN");
  process.exit(1);
}

if (!OWNER_ID) {
  console.error("❌ Falta OWNER_ID");
  process.exit(1);
}

if (!GROQ_API) {
  console.error("❌ Falta GROQ_API");
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
  partials: [
    Partials.Channel
  ]
});

// =====================
// MEMORIA
// =====================

const activeChats =
  new Map();

const memories =
  new Map();

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

  "Buscando tesoros",

  "Hablando con Cave Raiders",

  "Estudiando artefactos"

];

// =====================
// CEREBRAS AI
// =====================

import { Cerebras } from "cerebras-cloud-sdk";

// =====================
// ENV CEREBRAS
// =====================

const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

if (!CEREBRAS_API_KEY) {
  console.error("❌ Falta CEREBRAS_API_KEY");
  process.exit(1);
}

const cerebras = new Cerebras({
  apiKey: CEREBRAS_API_KEY
});

// =====================
// IA FUNCTION
// =====================

async function askCerebras(userId, message) {

  const historyText = buildHistory(userId);

  const completion = await cerebras.chat.completions.create({
    model: "gpt-oss-120b",

    messages: [
      {
        role: "system",
        content: NANACHI_PROMPT
      },
      {
        role: "user",
        content: `${historyText}\n\nUsuario: ${message}`
      }
    ],

    max_completion_tokens: 350,
    temperature: 0.9,
    top_p: 1,
    stream: false,
    reasoning_effort: "medium"
  });

  const reply = completion?.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error("Respuesta vacía Cerebras");
  }

  // MEMORIA
  addMemory(userId, "user", message);
  addMemory(userId, "assistant", reply);

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

        // =====================
        // COPIA AL DM
        // =====================

        try {

          await owner.send(
            `📩 MENSAJE PARA NANACHI\n\n` +
            `👤 Usuario: ${message.author.tag}\n` +
            `🆔 ID: ${message.author.id}\n` +
            `🏠 Servidor: ${message.guild.name}\n` +
            `💬 Canal: #${message.channel.name}\n\n` +
            `📨 Mensaje:\n${message.content}\n\n` +
            `👉 Responde con:\n` +
            `n!write ${message.author.id} tu mensaje`
          );

        } catch (err) {

          console.log(
            "⚠️ Error DM:",
            err.message
          );
        }

        await message.channel.sendTyping();

        // =====================
        // IA
        // =====================

        try {

          const reply =
            await askGroq(
              message.author.id,
              message.content
            );

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

          console.log(
            "❌ GROQ ERROR:",
            err
          );

          try {

            const owner =
              await client.users.fetch(
                OWNER_ID
              );

            const shortError =
              String(
                err.message
              ).slice(
                0,
                1000
              );

            await owner.send(
              `⚠️ Error Groq\n\n${shortError}`
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
          OWNER_ID
      ) {

        if (
          !message.content.startsWith(
            "n!write"
          )
        ) return;

        const args =
          message.content.split(
            " "
          );

        if (
          args.length < 3
        ) {

          return message.reply(
            "Uso:\nn!write userID mensaje"
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
            "❌ No existe una conversación activa con ese usuario."
          );
        }

        try {

          const channel =
            await client.channels.fetch(
              chat.channelId
            );

          if (!channel) {

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
            "✅ Mensaje enviado."
          );

        } catch (err) {

          console.log(
            "❌ ERROR WRITE:",
            err
          );

          await message.reply(
            "❌ Error enviando mensaje."
          );
        }
      }

    } catch (err) {

      console.log(
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
        "Nanachi vive 🐇"
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

    console.log(
      "💥 ERROR GLOBAL:",
      err
    );
  }
);

process.on(
  "unhandledRejection",
  err => {

    console.log(
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
