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

// Usuarios y servidores que aceptaron TOS
const tosUsers = loadJSON("tos.json", []);
const tosServers = loadJSON("tosServers.json", []);
const welcomeData = loadJSON("welcome.json", {});

// =====================
// TOS
// =====================
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
              content: `Eres Nanachi, personaje del manga y anime Made in Abyss.
... (todo el contenido de Nanachi, igual que tu versión original) ...`
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
// INTERACCIONES
// =====================
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton()) {
    if (interaction.customId === "aceptar_tos_server") {
      aceptarTOSServidor(interaction.guildId);
      return interaction.update({
        content: "✅ TOS aceptados",
        components: []
      });
    }

    if (interaction.customId === "aceptar_tos_dm") {
      aceptarTOSUsuario(interaction.user.id);
      return interaction.update({
        content: "✅ TOS aceptados",
        components: []
      });
    }
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.guildId && !tosServers.includes(interaction.guildId)) {
    return interaction.reply({
      content: tosMessage(),
      ephemeral: true
    });
  }

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  let reply = cmd.reply ?? "…";
  reply = reply.replaceAll("{user}", `<@${interaction.user.id}>`);

  interaction.reply({
    content: reply,
    allowedMentions: { parse: [] }
  });
});

// =====================
// MENSAJES
// =====================
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;

  if (!msg.guild) {
    if (!tosUsers.includes(msg.author.id)) {
      const boton = new ButtonBuilder()
        .setCustomId("aceptar_tos_dm")
        .setLabel("Aceptar TOS")
        .setStyle(ButtonStyle.Success);

      return msg.reply({
        content: tosMessage(),
        components: [new ActionRowBuilder().addComponents(boton)],
        allowedMentions: { parse: [] }
      });
    }

    const reply = await longcatAI(msg.content, msg.author.id);
    return msg.reply({ content: reply });
  }

  if (!tosServers.includes(msg.guild.id)) return;

  const reply = await longcatAI(msg.content, msg.author.id);
  msg.reply({ content: reply, allowedMentions: { parse: [] } });
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
  res.end("nanachi viva 💖");
}).listen(process.env.PORT || 3000);

// =====================
// AUTO PING (SAFE)
if (PING_URL) {
  setInterval(async () => {
    try {
      await fetch(PING_URL);
      console.log("🌐 Ping OK — servicio activo");
    } catch {}
  }, 1000 * 60 * 5);
}

// =====================
// LOGIN
// =====================
client.login(TOKEN);
