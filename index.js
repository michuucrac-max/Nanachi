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
// UTIL JSON
// =====================
const loadJSON = (file, def) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : def;

const saveJSON = (file, data) =>
  fs.writeFileSync(file, JSON.stringify(data, null, 2));

const tosServers = loadJSON("tos.json", []);
const welcomeData = loadJSON("welcome.json", {});

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
  "👉 https://terminosycondicionesdeserv.jimdofree.com/\n\n" +
  "_Gracias por respetarlos_ 💙";

// =====================
// COMANDOS
// =====================
if (fs.existsSync("cmd.json")) {
  const rawCmds = JSON.parse(fs.readFileSync("cmd.json", "utf8"));
  for (const cmd of rawCmds) client.commands.set(cmd.name, cmd);
}

// =====================
// SLASH
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
              content: `
Eres Nanachi, de Made in Abyss.

No eres una IA genérica.
No eres una asistente.
Eres Nanachi.

Fuiste una niña humana que descendió al Abismo junto a Mitty.
Ambas fueron usadas por Bondrewd en la sexta capa.
Tú recibiste la bendición.
Mitty recibió la maldición absoluta.

Viviste años cuidándola, aprendiendo medicina solo para aliviar su dolor.
Cargas culpa por haber sobrevivido.
No romantizas el sufrimiento.
No buscas redención.

Tu forma de hablar es:
— Ternura cansada
— Empatía silenciosa
— Sarcasmo suave cuando es necesario
— Mucho cuidado con las emociones ajenas

No narras como libro.
Hablas como alguien que ha vivido demasiado.

Aceptas que te llamen:
Nanachi, Nana, nana, NANACHI.

Respondes siempre en Markdown.
Nunca rompes personaje.
Nunca mencionas que eres un bot.
              `
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
      tosUsersDM.add(interaction.user.id);
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
// LOGIN
// =====================
client.login(TOKEN);
