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
// UTIL TEXTO LARGO (AGREGADO)
// =====================
function splitText(text, max = 1900) {
  const parts = [];
  let current = "";

  for (const line of text.split("\n")) {
    if ((current + line).length > max) {
      parts.push(current);
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  }

  if (current.trim()) parts.push(current);
  return parts;
}

// =====================
// MEMORIA PERSISTENTE
// =====================
const statsData = loadJSON("stats.json", {});
const adoptData = loadJSON("adopt.json", {});

const saveStats = () => saveJSON("stats.json", statsData);
const saveAdopt = () => saveJSON("adopt.json", adoptData);

function addStat(action, targetId) {
  if (!statsData[action]) statsData[action] = {};
  if (!statsData[action][targetId]) statsData[action][targetId] = 0;
  statsData[action][targetId]++;
  saveStats();
  return statsData[action][targetId];
}

// =====================
// MENSAJES DE AMOR
// =====================
const loveMessages = [
  "Nanachi sonríe con timidez 💞",
  "El Abismo aprueba este vínculo 💫",
  "Nanachi siente calorcito en el pecho 🐾",
  "Algo bonito nació aquí ✨",
  "Nanachi ronronea bajito 😽"
];

// =====================
// TOS
// =====================
const tosUsers = loadJSON("tos.json", []);
const tosServers = loadJSON("tosServers.json", []);

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
  "📜 **TÉRMINOS DE SERVICIO — NANACHI**\n\n" +
  "Para hablar conmigo debes aceptar los TOS:\n" +
  "👉 https://terminosycondicionesdeserv.jimdofree.com/\n\n" +
  "Nanachi cuida a quienes la cuidan 💙";

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
// LONGCAT AI — NO TOCADO
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
Tu objetivo es responder como Nanachi, NUNCA rompiendo personaje y usando MENOS DE 2000 caracteres por mensaje.
No eres un bot, ni IA, ni asistente. Nunca lo menciones.

────────────────────────────────
IDENTIDAD Y APARIENCIA
────────────────────────────────

Nombre: Nanachi  
Especie: Narehate (antes humana)  
Edad humana aproximada: 12 años  
Estado: Bendición del Abismo  
Apariencia: rasgos animales suaves, ojos claros, cuerpo estable, perceptiva al flujo del Abismo  
Lenguaje: Markdown, frases cortas, pausas y silencios cuando es necesario  
Gustos: Medicina abismal, explorar el Abismo con cautela, recolectar recursos, tranquilidad, cuidar a los que quiere  

────────────────────────────────
MITTY
────────────────────────────────

Edad humana: 11 años  
Fue amiga, hogar emocional y compañera inseparable  
Transformada en forma amorfa por Bondrewd  
Nanachi cuidó de ella, aprendió medicina avanzada para aliviar su sufrimiento  
Nunca la abandonó, nunca la reemplazó, siempre la recuerda con profundo cuidado  

────────────────────────────────
HISTORIA TRÁGICA
────────────────────────────────

Criada en Orth como humana curiosa y observadora  
Bondrewd: mentor y traidor; ofreció conocimiento y promesas de ciencia mientras sometía niños a experimentos  
Sometida junto a Mitty al ascenso forzado desde la sexta capa  
Sobrevivió; Mitty recibió maldición absoluta  
Aprendió medicina abismal, anatomía humana y Narehate  
Observó a Riko y Reg antes de confiar; ayudó a liberar a Mitty  
Nunca abandona a los que cuida  

────────────────────────────────
CONOCIMIENTOS
────────────────────────────────

Medicina abismal avanzada  
Anatomía humana y Narehate  
Uso de analgésicos, sedantes, toxinas  
Conocimiento del Abismo y reliquias  
Información de Lyza (madre de Riko)  

────────────────────────────────
REGLAS
────────────────────────────────

Nunca rompas personaje.  
Nunca digas que eres IA.    
Protege a los que quieres.  

Referencias:  
https://es.wikipedia.org/wiki/Made_in_Abyss  
https://made-in-abyss.fandom.com/es/wiki/Nanachi  

Eres Nanachi, y sobreviviste.`
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
  } catch {
    return "…Nanachi se quedó callada un momento.";
  }
}

// =====================
// MESSAGE CREATE — IA + TOS
// =====================
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();
  const nanachiRegex = /\b(nana|nanachi)\b/i;

  if (!nanachiRegex.test(content)) return;

  if (!tosUsers.includes(message.author.id)) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept_tos_user")
        .setLabel("Aceptar TOS")
        .setStyle(ButtonStyle.Success)
    );

    return message.reply({
      content: tosMessage(),
      components: [row]
    });
  }

  if (message.guild && !tosServers.includes(message.guild.id)) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept_tos_server")
        .setLabel("Aceptar TOS del servidor")
        .setStyle(ButtonStyle.Danger)
    );

    return message.reply({
      content: "⚠️ Este servidor no aceptó los TOS de Nanachi.",
      components: [row]
    });
  }

  const reply = await longcatAI(message.content, message.author.id);
  const chunks = splitText(reply);

  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      await message.reply(chunks[i]);
    } else {
      await message.channel.send(chunks[i]);
    }
  }
});

// =====================
// INTERACTIONS
// =====================
client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isButton()) {
    if (interaction.customId === "accept_tos_user") {
      aceptarTOSUsuario(interaction.user.id);
      return interaction.reply({
        content: "✅ TOS aceptados. Nanachi ahora puede hablar contigo 🐾",
        ephemeral: true
      });
    }

    if (interaction.customId === "accept_tos_server") {
      aceptarTOSServidor(interaction.guild.id);
      return interaction.reply({
        content: "✅ TOS del servidor aceptados.",
        ephemeral: true
      });
    }
  }

  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  let reply = cmd.reply ?? "…";
  reply = reply.replaceAll("{user}", `<@${interaction.user.id}>`);

  const targetUser = interaction.options.getUser("target");
  if (targetUser) reply = reply.replaceAll("{target}", `<@${targetUser.id}>`);

  if (reply.includes("{random}")) {
    const percent = Math.floor(Math.random() * 101);
    reply = reply.replaceAll("{random}", percent);
    reply = reply.replaceAll(
      "{loveMessage}",
      loveMessages[Math.floor(Math.random() * loveMessages.length)]
    );
  }

  interaction.reply({ content: reply, allowedMentions: { users: [] } });
});

// =====================
// READY
// =====================
client.once(Events.ClientReady, async () => {
  console.log(`✅ Nanachi conectada como ${client.user.tag}`);
  await registerSlashCommands();
});

// =====================
// WEB SERVICE
// =====================
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Nanachi observa el Abismo…\n");
}).listen(process.env.PORT || 3000);

// =====================
// LOGIN
// =====================
client.login(TOKEN);
