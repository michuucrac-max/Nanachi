// -------------------------
//  NANACHI — INDEX.JS (STABLE)
// -------------------------

import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
  Events,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from "discord.js";

import fs from "fs";
import fetch from "node-fetch";
import http from "http";

// =====================
// ENV
// =====================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const LONGCAT_API = process.env.LONGCAT_API;
const PORT = process.env.PORT || 3000;

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

client.commands = new Collection();
const memory = new Map();
const tosUsersDM = new Set();

// =====================
// JSON UTILS
// =====================
const loadJSON = (file, def) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : def;

const saveJSON = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

const tosServers = loadJSON("tos.json", []);

// =====================
// TOS
// =====================
const aceptarTOSServidor = guildId => {
  if (!tosServers.includes(guildId)) {
    tosServers.push(guildId);
    saveJSON("tos.json", tosServers);
  }
};

const tosMessage = () =>
  "**📜 TÉRMINOS DE SERVICIO — NANACHI**\n\n" +
  "Para hablar conmigo debes aceptar los TOS:\n" +
  "👉 https://terminosycondicionesdeserv.jimdofree.com/";

// =====================
// LONGCAT AI (SAFE)
// =====================
async function longcatAI(message, userId) {
  if (!LONGCAT_API) return "…Nanachi guarda silencio un momento.";

  const history = memory.get(userId) ?? [];
  history.push({ role: "user", content: message });

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 15000); // timeout 15s

    const res = await fetch(
      "https://api.longcat.chat/openai/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${LONGCAT_API}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "LongCat-Flash-Chat",
          messages: [
            { role: "system", content: "Eres Nanachi. Nunca rompes personaje." },
            ...history
          ]
        })
      }
    );

    if (!res.ok) throw new Error("API no respondió bien");

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) throw new Error("Respuesta vacía");

    history.push({ role: "assistant", content: reply });
    memory.set(userId, history.slice(-10));
    return reply;

  } catch (e) {
    console.warn("⚠️ IA falló:", e.message);
    return "…mi cabeza dio vueltas un poco. Dame un segundo.";
  }
}

// =====================
// EVENTS
// =====================
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;

  if (!msg.guild) {
    if (!tosUsersDM.has(msg.author.id)) {
      const boton = new ButtonBuilder()
        .setCustomId("aceptar_tos_dm")
        .setLabel("Aceptar TOS")
        .setStyle(ButtonStyle.Success);

      return msg.reply({
        content: tosMessage(),
        components: [new ActionRowBuilder().addComponents(boton)]
      });
    }

    const reply = await longcatAI(msg.content, msg.author.id);
    return msg.reply(reply);
  }

  if (!tosServers.includes(msg.guild.id)) return;

  const reply = await longcatAI(msg.content, msg.author.id);
  msg.reply(reply);
});

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
  console.log(`✅ Nanachi conectada como ${client.user.tag}`);
});

// =====================
// KEEP ALIVE SERVER
// =====================
const server = http.createServer((_, res) => {
  res.writeHead(200);
  res.end("nanachi viva 💖");
});

server.listen(PORT, () =>
  console.log("🌐 Web server activo")
);

// =====================
// SELF PING (ANTI SLEEP)
// =====================
setInterval(() => {
  fetch(`http://localhost:${PORT}`)
    .then(() => console.log("🔁 Self-ping OK"))
    .catch(() => console.log("⚠️ Self-ping falló"));
}, 1000 * 60 * 2); // cada 2 minutos

// =====================
// GLOBAL ANTI-CRASH
// =====================
process.on("unhandledRejection", err => {
  console.error("💥 Unhandled rejection:", err);
});

process.on("uncaughtException", err => {
  console.error("💥 Uncaught exception:", err);
});

// =====================
// LOGIN
// =====================
client.login(TOKEN);
