// -------------------------
//  NANACHI — INDEX.JS (FIX)
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
const tosUsersDM = new Set();

// =====================
// ARCHIVOS
// =====================
const loadJSON = (file, def) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : def;

const saveJSON = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

const tosServers = loadJSON("tos.json", []);
const welcomeData = loadJSON("welcome.json", {});
const ytChannels = loadJSON("ytChannels.json", {});
const ytList = loadJSON("yt.json", []);

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
  "Para usarme debes aceptar los TOS:\n" +
  "👉 https://terminosycondicionesdeserv.jimdofree.com/\n\n" +
  "_Léelos con atención por favor_ 💙";

// =====================
// CARGAR COMANDOS
// =====================
if (fs.existsSync("cmd.json")) {
  const rawCmds = JSON.parse(fs.readFileSync("cmd.json", "utf8"));
  for (const cmd of rawCmds) client.commands.set(cmd.name, cmd);
}

// =====================
// REGISTRAR SLASH COMMANDS
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
// LONGCAT AI
// =====================
async function longcatAI(message, userId) {
  if (!LONGCAT_API) return "…nanachi te escucha en silencio 💭";

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
              content:
                "Eres Nanachi. Respondes SIEMPRE en Markdown. Tono tierno, sarcástico, amable y respetuoso. Mundo Made in Abyss."
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
    return "💖 Nanachi tuvo un pequeño mareo… intenta otra vez";
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
        content: "✅ TOS aceptados — Nanachi activada",
        components: []
      });
    }

    if (interaction.customId === "aceptar_tos_dm") {
      tosUsersDM.add(interaction.user.id);
      return interaction.update({
        content: "✅ TOS aceptados en MD — Nanachi activada",
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

  let reply = cmd.reply ?? "ok";
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

  // DM
  if (!msg.guild) {
    if (!tosUsersDM.has(msg.author.id)) {
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

  // Servidores
  if (!tosServers.includes(msg.guild.id)) return;

  const reply = await longcatAI(msg.content, msg.author.id);
  msg.reply({
    content: `💬 **Nanachi dice:**\n\n${reply}`,
    allowedMentions: { parse: [] }
  });
});

// =====================
// BIENVENIDA / DESPEDIDA
// =====================
client.on(Events.GuildMemberAdd, async member => {
  const cfg = welcomeData[member.guild.id];
  if (!cfg?.welcome) return;

  const canal = await member.guild.channels.fetch(cfg.welcome).catch(() => null);
  if (!canal) return;

  canal.send({
    content: `🌸 **Nuevo miembro**\nHola ${member.user.username}! 💖`,
    allowedMentions: { parse: [] }
  });
});

client.on(Events.GuildMemberRemove, async member => {
  const cfg = welcomeData[member.guild.id];
  if (!cfg?.bye) return;

  const canal = await member.guild.channels.fetch(cfg.bye).catch(() => null);
  if (!canal) return;

  canal.send({
    content: `👋 **Despedida**\n${member.user.username} salió del servidor`,
    allowedMentions: { parse: [] }
  });
});

// =====================
// READY
// =====================
client.once(Events.ClientReady, async () => {
  console.log(`✅ Nanachi conectada como ${client.user.tag}`);
  await registerSlashCommands();
});

// =====================
// KEEP ALIVE (RENDER)
// =====================
http.createServer((_, res) => {
  res.writeHead(200);
  res.end("nanachi viva 💖");
}).listen(process.env.PORT || 3000);

// =====================
// LOGIN
// =====================
client.login(TOKEN);
