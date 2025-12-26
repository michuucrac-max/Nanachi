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
const PING_URL = "https://example.com";

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
  } catch (e) {
    console.error("⚠️ Error guardando", file);
  }
};

const tosServers = loadJSON("tos.json", []);
const welcomeData = loadJSON("welcome.json", {});

// =====================
// TOS
// =====================
const aceptarTOSServidor = guildId => {
  if (!guildId) return;
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
  try {
    const rawCmds = JSON.parse(fs.readFileSync("cmd.json", "utf8"));
    for (const cmd of rawCmds) client.commands.set(cmd.name, cmd);
  } catch {}
}

// =====================
// SLASH COMMANDS
// =====================
async function registerSlashCommands() {
  try {
    if (!fs.existsSync("cmd.json")) return;

    const rawCmds = JSON.parse(fs.readFileSync("cmd.json", "utf8"));
    const slashCommands = rawCmds.map(c => ({
      name: c.name,
      description: c.description,
      options: c.options ?? []
    }));

    const rest = new REST({ version: "10" }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), {
      body: slashCommands
    });

    console.log("✅ Slash commands registrados");
  } catch (e) {
    console.error("⚠️ Error slash:", e.message);
  }
}

// =====================
// LONGCAT AI
// =====================
async function longcatAI(message, userId) {
  if (!LONGCAT_API) return "…";

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
          messages: history
        })
      }
    );

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content ?? "…";

    history.push({ role: "assistant", content: reply });
    memory.set(userId, history.slice(-10));

    return reply;
  } catch (e) {
    console.error("⚠️ IA error:", e.message);
    return "…";
  }
}

// =====================
// INTERACTIONS (SAFE)
// =====================
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (!interaction.isButton()) return;

    if (interaction.customId === "aceptar_tos_server") {
      aceptarTOSServidor(interaction.guildId);
    }

    if (interaction.customId === "aceptar_tos_dm") {
      tosUsersDM.add(interaction.user.id);
    }

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "✅ TOS aceptados",
        ephemeral: true
      });
    }
  } catch (e) {
    console.error("⚠️ Interaction error:", e.message);
  }
});

// =====================
// MESSAGES
// =====================
client.on(Events.MessageCreate, async msg => {
  try {
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
          components: [new ActionRowBuilder().addComponents(boton)]
        });
      }

      const reply = await longcatAI(msg.content, msg.author.id);
      return msg.reply({ content: reply });
    }

    // GUILD
    if (!tosServers.includes(msg.guild.id)) return;

    const reply = await longcatAI(msg.content, msg.author.id);
    await msg.reply({ content: reply });
  } catch (e) {
    console.error("⚠️ Message error:", e.message);
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
  res.end("ok");
}).listen(process.env.PORT || 3000);

// =====================
// AUTO PING (2 MIN)
// =====================
setInterval(async () => {
  try {
    await fetch(PING_URL);
    console.log("🌐 ping");
  } catch {}
}, 1000 * 60 * 2);

// =====================
// SAFETY NET
// =====================
process.on("unhandledRejection", err =>
  console.error("🔥 unhandledRejection:", err)
);
process.on("uncaughtException", err =>
  console.error("🔥 uncaughtException:", err)
);

// =====================
// LOGIN
// =====================
client.login(TOKEN);
