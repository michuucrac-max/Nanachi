// ================================
// NANACHI BOT — DEBUG TOTAL
// ================================

console.log("🚨 INICIANDO PROCESO...");

import {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType
} from "discord.js";

import http from "http";

// =====================
// VARIABLES (RENDER)
// =====================
const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;

console.log("🔎 TOKEN:", TOKEN ? "OK" : "NO");

// =====================
// VALIDACIÓN TOKEN
// =====================
if (!TOKEN) {
  console.error("❌ TOKEN NO DEFINIDO EN RENDER");
  process.exit(1);
}

// =====================
// CLIENT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =====================
// READY
// =====================
client.once(Events.ClientReady, () => {
  console.log("✅ BOT CONECTADO COMO:", client.user.tag);

  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "Observando el Abismo…",
        type: ActivityType.Playing
      }
    ]
  });
});

// =====================
// MENSAJES (RESPUESTA SIMPLE)
// =====================
client.on(Events.MessageCreate, async (msg) => {
  try {
    if (msg.author.bot) return;

    console.log("📩 MENSAJE:", msg.content);

    if (msg.mentions.has(client.user)) {
      await msg.reply("…Estoy aquí.");
    }

  } catch (err) {
    console.error("❌ ERROR EN MENSAJE:", err);
  }
});

// =====================
// KEEP ALIVE (RENDER)
// =====================
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot activo");
}).listen(PORT, () => {
  console.log("🌐 WEB SERVER OK EN PUERTO", PORT);
});

// =====================
// LOGIN
// =====================
console.log("🔵 INTENTANDO LOGIN...");

client.login(TOKEN)
  .then(() => console.log("🟢 LOGIN EXITOSO"))
  .catch(err => console.error("🔴 LOGIN ERROR:", err));
