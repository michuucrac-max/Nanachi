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
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

if (!TOKEN) {
  console.error("❌ Falta TOKEN");
  process.exit(1);
}

if (!OWNER_ID) {
  console.error("❌ Falta OWNER_ID");
  process.exit(1);
}

if (!CEREBRAS_API_KEY) {
  console.error("❌ Falta CEREBRAS_API_KEY");
  process.exit(1);
}

// =====================
// NANACHI PROMPT
// =====================

let NANACHI_PROMPT = `Eres Nanachi.`;

try {
  const txt = fs.readFileSync("nanachi.txt", "utf8");
  if (txt.trim()) NANACHI_PROMPT = txt;
  console.log("✅ nanachi.txt cargado");
} catch {
  console.log("⚠️ nanachi.txt no encontrado");
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

function addMemory(userId, role, content) {
  const history = memories.get(userId) || [];

  history.push({ role, content });

  while (history.length > 20) {
    history.shift();
  }

  memories.set(userId, history);
}

function buildHistory(userId) {
  const history = memories.get(userId) || [];

  return history
    .map(e =>
      `${e.role === "user" ? "Usuario" : "Nanachi"}: ${e.content}`
    )
    .join("\n");
}

// =====================
// ESTADOS
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
// IA (CEREBRAS - FETCH DIRECTO)
// =====================

async function askCerebras(userId, message) {

  const historyText = buildHistory(userId);

  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CEREBRAS_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
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

      max_tokens: 350,
      temperature: 0.9,
      top_p: 1
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.log(data);
    throw new Error(data?.error?.message || "Error Cerebras");
  }

  const reply = data?.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error("Respuesta vacía Cerebras");
  }

  addMemory(userId, "user", message);
  addMemory(userId, "assistant", reply);

  return reply;
}


// =====================
// READY
// =====================

client.once(Events.ClientReady, () => {

  console.log(`✅ Conectada como ${client.user.tag}`);

  let index = 0;

  client.user.setActivity(statuses[0], {
    type: ActivityType.Playing
  });

  setInterval(() => {
    index = (index + 1) % statuses.length;

    client.user.setActivity(statuses[index], {
      type: ActivityType.Playing
    });
  }, 30000);
});

// =====================
// MESSAGE HANDLER
// =====================

client.on(Events.MessageCreate, async message => {
  try {

    if (message.author.bot) return;

    const isDM = !message.guild;
    const trigger = /\b(nana|nanachi)\b/i;

    // =====================
    // MENSAJES SERVIDOR
    // =====================

    if (!isDM && trigger.test(message.content)) {

      activeChats.set(message.author.id, {
        channelId: message.channel.id,
        guildId: message.guild.id
      });

      const owner = await client.users.fetch(OWNER_ID);

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
        console.log("⚠️ Error DM:", err.message);
      }

      await message.channel.sendTyping();

      try {

        const reply = await askCerebras(
          message.author.id,
          message.content
        );

        const safeReply =
          reply.length > 1900 ? reply.slice(0, 1900) : reply;

        await message.reply(safeReply);

      } catch (err) {

        console.log("❌ IA ERROR:", err);

        try {
          const owner = await client.users.fetch(OWNER_ID);

          await owner.send(
            `⚠️ Error IA\n\n${String(err.message).slice(0, 1000)}`
          );
        } catch {}

        await message.reply("Nanachi se quedó pensando...");
      }
    }

    // =====================
    // N!WRITE (OWNER DM)
    // =====================

    if (isDM && message.author.id === OWNER_ID) {

      if (!message.content.startsWith("n!write")) return;

      const args = message.content.split(" ");

      if (args.length < 3) {
        return message.reply("Uso:\nn!write userID mensaje");
      }

      const userId = args[1];
      const text = args.slice(2).join(" ");

      const chat = activeChats.get(userId);

      if (!chat) {
        return message.reply("❌ No hay chat activo con ese usuario.");
      }

      try {

        const channel = await client.channels.fetch(chat.channelId);

        if (!channel) {
          return message.reply("❌ Canal no encontrado.");
        }

        await channel.send(text);

        addMemory(userId, "assistant", text);

        await message.reply("✅ Mensaje enviado.");

      } catch (err) {
        console.log("❌ WRITE ERROR:", err);
        await message.reply("❌ Error enviando mensaje.");
      }
    }

  } catch (err) {
    console.log("💥 ERROR GENERAL:", err);
  }
});

// =====================
// KEEP ALIVE
// =====================

http.createServer((_, res) => {
  res.writeHead(200);
  res.end("Nanachi vive 🐇");
}).listen(process.env.PORT || 3000);

// =====================
// ANTI CRASH
// =====================

process.on("uncaughtException", err => {
  console.log("💥 ERROR GLOBAL:", err);
});

process.on("unhandledRejection", err => {
  console.log("💥 PROMISE ERROR:", err);
});

// =====================
// LOGIN
// =====================

client.login(TOKEN);
