// -------------------------
//  NANACHI — INDEX.JS
// -------------------------

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  ActivityType
} from "discord.js";

import fs from "fs";
import fetch from "node-fetch";
import http from "http";

// =====================
// ENV
// =====================

const TOKEN = process.env.TOKEN;
const LONGCAT_API = process.env.LONGCAT_API;

if (!TOKEN) {
  console.error("❌ Falta TOKEN");
  process.exit(1);
}

// =====================
// HISTORIA NANACHI
// =====================

let NANACHI_PROMPT = "Eres Nanachi.";

try {
  NANACHI_PROMPT = fs.readFileSync(
    "nanachi.txt",
    "utf8"
  );

  console.log("✅ Historia cargada");
} catch {
  console.log(
    "⚠️ No se encontró nanachi.txt"
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

const memory = new Map();
const lastReply = new Map();

// =====================
// JSON
// =====================

const loadJSON = (file, def) => {
  try {
    return fs.existsSync(file)
      ? JSON.parse(
          fs.readFileSync(file, "utf8")
        )
      : def;
  } catch {
    return def;
  }
};

// =====================
// ESTADOS
// =====================

const estadosRaw = loadJSON(
  "estados.json",
  []
);

const estados = Array.isArray(estadosRaw)
  ? estadosRaw.filter(
      estado =>
        typeof estado === "string"
    )
  : [];

let estadoIndex = 0;

function rotarEstados() {
  if (!client.user) return;

  if (!estados.length) return;

  client.user.setActivity(
    estados[
      estadoIndex % estados.length
    ],
    {
      type: ActivityType.Playing
    }
  );

  estadoIndex++;
}

// =====================
// TEXTO
// =====================

function splitText(
  text,
  max = 1800
) {
  if (typeof text !== "string")
    return [];

  const parts = [];
  let current = "";

  for (const line of text.split("\n")) {
    if (
      (current + line).length > max
    ) {
      parts.push(current);
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}

function limitReply(
  text,
  max = 1800
) {
  if (typeof text !== "string")
    return "";

  return text.length <= max
    ? text
    : text.slice(0, max);
}

function cleanReply(text) {
  if (!text) return "";

  return text
    .replace(
      /^\s*\.+\s*$/gm,
      ""
    )
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .trim();
}

// =====================
// LONGCAT AI
// =====================

async function longcatAI(
  message,
  userId
) {
  if (!LONGCAT_API) {
    return "…Nanachi te escucha.";
  }

  const history =
    memory.get(userId) ?? [];

  history.push({
    role: "user",
    content: message
  });

  try {
    const res = await fetch(
      "https://api.longcat.chat/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LONGCAT_API}`,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          model:
            "LongCat-Flash-Chat",
          messages: [
            {
              role: "system",
              content:
                NANACHI_PROMPT
            },
            ...history
          ]
        })
      }
    );

    const data =
      await res.json();

    let reply =
      data?.choices?.[0]
        ?.message?.content;

    if (!reply)
      throw new Error();

    reply = cleanReply(
      limitReply(reply)
    );

    history.push({
      role: "assistant",
      content: reply
    });

    memory.set(
      userId,
      history.slice(-8)
    );

    return reply;
  } catch (err) {
    console.log(err);

    return "…Nanachi guarda silencio.";
  }
}

// =====================
// READY
// =====================

client.once(
  Events.ClientReady,
  async () => {
    console.log(
      `✅ Conectada como ${client.user.tag}`
    );

    client.user.setActivity(
      "Observando el Abismo…",
      {
        type:
          ActivityType.Playing
      }
    );

    if (estados.length) {
      setInterval(
        rotarEstados,
        120000
      );
    }
  }
);

// =====================
// RESPONDER MENSAJE
// =====================

client.on(
  Events.MessageCreate,
  async message => {
    if (message.author.bot)
      return;

    const isDM =
      !message.guild;

    const call =
      /\b(nana|nanachi)\b/i;

    if (
      !isDM &&
      !call.test(
        message.content
      )
    )
      return;

    const now = Date.now();

    const last =
      lastReply.get(
        message.author.id
      ) ?? 0;

    if (now - last < 4000)
      return;

    lastReply.set(
      message.author.id,
      now
    );

    await message.channel.sendTyping();

    const reply =
      await longcatAI(
        message.content,
        message.author.id
      );

    if (!reply) return;

    const chunks =
      splitText(reply);

    await message.reply(
      chunks.shift()
    );

    for (const chunk of chunks) {
      await message.channel.send(
        chunk
      );
    }
  }
);

// =====================
// WEB SERVICE
// =====================

http
  .createServer(
    (_, res) => {
      res.writeHead(200);

      res.end(
        "Nanachi observa el Abismo..."
      );
    }
  )
  .listen(
    process.env.PORT ||
      3000
  );

// =====================
// login
// =====================

client.login(TOKEN);

// =====================
// TEXTO
// =====================

