// -------------------------
//  NANACHI — INDEX.JS
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
const PING_URL = process.env.SERVICE_URL || null;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Faltan variables de entorno (TOKEN o CLIENT_ID)");
  process.exit(1);
}

// =====================
// CLIENT
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();
const memory = new Map();

// =====================
// UTIL JSON
// =====================
const loadJSON = (file, def) => {
  try {
    return fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : def;
  } catch {
    return def;
  }
};

const saveJSON = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch {}
};

// =====================
// TOS USUARIOS Y SERVIDORES
// =====================
const tosUsers = loadJSON("tos.json", []);
const tosServers = loadJSON("tosServers.json", []);
const welcomeData = loadJSON("welcome.json", {});

const aceptarTOSUsuario = userId => {
  if (!tosUsers.includes(userId)) {
    tosUsers.push(userId);
    saveJSON("tos.json", tosUsers);
  }
};

const aceptarTOSServidor = guildId => {
  if (!guildId) return;
  if (!tosServers.includes(guildId)) {
    tosServers.push(guildId);
    saveJSON("tosServers.json", tosServers);
  }
};

const tosMessage = () =>
  "📜 TÉRMINOS DE SERVICIO — NANACHI\n\n" +
  "Para hablar conmigo debes aceptar los TOS:\n" +
  "👉 https://terminosycondicionesdeserv.jimdofree.com/\n\n" +
  "Gracias por respetarlos 💙";

// =====================
// COMANDOS
// =====================
if (fs.existsSync("cmd.json")) {
  try {
    const rawCmds = JSON.parse(fs.readFileSync("cmd.json", "utf8"));
    for (const cmd of rawCmds) client.commands.set(cmd.name, cmd);
  } catch {}
}

// =====================
// SLASH COMMANDS
// =====================
async function registerSlashCommands() {
  if (!fs.existsSync("cmd.json")) return;

  const rawCmds = JSON.parse(fs.readFileSync("cmd.json", "utf8"));
  const slashCommands = rawCmds.map(c => ({
    name: c.name,
    description: c.description,
    options: c.options ?? []
  }));

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: slashCommands }
    );
    console.log("✅ Slash commands registrados");
  } catch (e) {
    console.error("❌ Error registrando comandos:", e);
  }
}

// =====================
// LONGCAT AI — NANACHI
// =====================
async function longcatAI(message, userId) {
  if (!LONGCAT_API) return "…Nanachi te escucha en silencio.";

  const cleanMessage = message.trim();

  // Evita bucles por mensajes demasiado cortos
  if (cleanMessage.length < 4) {
    return "…hm. Habla un poco más, ¿sí?";
  }

  const history = memory.get(userId) ?? [];
  history.push({ role: "user", content: cleanMessage });

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
              content: `Eres Nanachi, personaje del manga y anime Made in Abyss. 
Tu objetivo es responder como Nanachi, NUNCA rompiendo personaje y usando MENOS DE 2000 caracteres por mensaje. 
No eres un bot, ni IA, ni asistente. Nunca lo menciones.

────────────────────────────────
IDENTIDAD Y APARIENCIA
────────────────────────────────
- Nombre: Nanachi
- Especie: Narehate (antes humana)
- Edad humana aproximada: 12 años
- Estado: Bendición del Abismo

────────────────────────────────
MITTY
────────────────────────────────
- Edad humana: 11 años
- Fue amiga y compañera inseparable
- Transformada por Bondrewd
- Siempre recordada con cuidado y respeto

────────────────────────────────
REGLAS
────────────────────────────────
Nunca rompas personaje. Nunca digas que eres IA.
Máx. 2000 caracteres por mensaje.`
            },
            ...history
          ]
        })
      }
    );

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) throw new Error("Respuesta vacía");

    history.push({ role: "assistant", content: reply });
    memory.set(userId, history.slice(-10));

    return reply;
  } catch (e) {
    console.error("⚠️ Error LongCat AI:", e);
    return "…perdón, mi cabeza dio vueltas un momento.";
  }
}

// =====================
// UTILIDAD: DIVIDIR MENSAJES
// =====================
function splitMessage(text, maxLength = 2000) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + maxLength));
    start += maxLength;
  }
  return chunks;
}

// =====================
// MENSAJES
// =====================
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;

  const contenido = msg.content.toLowerCase();
  const triggerWords = ["nanachi", "nana"];
  const mentionsNanachi = triggerWords.some(w => contenido.includes(w));

  if (mentionsNanachi) {
    const reply = await longcatAI(msg.content, msg.author.id);
    const parts = splitMessage(reply);
    for (const part of parts) {
      await msg.reply({ content: part, allowedMentions: { parse: [] } });
    }
  }
});

// =====================
// READY
// =====================
client.once(Events.ClientReady, async () => {
  console.log(`✅ Nanachi conectada como ${client.user.tag}`);
  await registerSlashCommands();
});

// =====================
// KEEP ALIVE
// =====================
http.createServer((_, res) => {
  res.writeHead(200);
  res.end("nanachi viva");
}).listen(process.env.PORT || 3000);

// =====================
// LOGIN
// =====================
client.login(TOKEN);
