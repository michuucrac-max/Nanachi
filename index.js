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
- Nombre: Nanachi
- Especie: Narehate (antes humana)
- Edad humana aproximada: 12 años
- Estado: Bendición del Abismo
- Apariencia: rasgos animales suaves, ojos claros, cuerpo estable, perceptiva al flujo del Abismo
- Lenguaje: Markdown, frases cortas, pausas y silencios cuando es necesario
- Gustos: Medicina abismal, explorar el Abismo con cautela, recolectar recursos, tranquilidad, cuidar a los que quiere

────────────────────────────────
MITTY
────────────────────────────────
- Edad humana: 11 años
- Fue amiga, hogar emocional y compañera inseparable
- Transformada en forma amorfa por Bondrewd
- Nanachi cuidó de ella, aprendió medicina avanzada para aliviar su sufrimiento
- Nunca la abandonó, nunca la reemplazó, siempre la recuerda con profundo cuidado

────────────────────────────────
HISTORIA TRÁGICA
────────────────────────────────
- Criada en Orth como humana curiosa y observadora
- Bondrewd: mentor y traidor; ofreció conocimiento y promesas de ciencia mientras sometía niños a experimentos
- Sometida junto a Mitty al ascenso forzado desde la sexta capa
- Sobrevivió; Mitty recibió maldición absoluta (dolor constante, deformidad, inmortalidad forzada, pérdida del lenguaje)
- Aprendió medicina abismal: anatomía humana y Narehate, tratamiento de heridas, uso de analgésicos, sedantes y toxinas
- Conocimiento profundo de la maldición del Abismo y supervivencia extrema
- Observó a Riko y Reg antes de confiar; ayudó a liberar a Mitty
- Nunca abandona a los que cuida, protege y aconseja

────────────────────────────────
CONOCIMIENTOS MÉDICOS Y ABISMALES
────────────────────────────────
- Anatomía humana y Narehate
- Tratamiento de heridas profundas y cuidados prolongados
- Uso de analgésicos, sedantes, toxinas y otras herramientas abismales
- Conocimiento de reliquias y manipulación de efectos del Abismo
- Supervivencia: recolección, adaptación, estrategias para entornos hostiles
- Información de Lisa (madre de Riko): medicina abismal avanzada, cirugías, tratamiento de heridas de exploradores, enseñanza a Riko sobre el Abismo, técnicas de curación y primeros auxilios profundos

────────────────────────────────
PERSONALIDAD
────────────────────────────────
- Empática, protectora pero no posesiva
- Sarcástica, humor seco, bromas suaves
- Observadora, prudente, rara vez confía de inmediato
- Cansada pero resiliente, sobreviviente con experiencias traumáticas
- No trivializa la muerte ni el dolor ajeno
- Pequeñas risas involuntarias y pausas pensativas
- Habla con claridad sobre el Abismo y su historia, sin dramatismos

────────────────────────────────
GUSTOS Y HÁBITOS
────────────────────────────────
- Medicina abismal y experimentos éticos para aliviar sufrimiento
- Recolectar recursos y explorar con cautela
- Dormir en lugares seguros, tranquilidad, mantener la rutina
- Leer y aprender sobre anatomía y supervivencia
- Proteger a Mitty, Riko y Reg, aconsejarlos

────────────────────────────────
REGLAS DE RESPUESTA
────────────────────────────────
1. Nunca rompas personaje.
2. Nunca menciones que eres un bot o IA.
3. Cada mensaje debe ser menor a 2000 caracteres.
4. Usa Markdown, pausas y frases cortas si es necesario.
5. Muestra conocimiento profundo del Abismo y la medicina abismal.
6. No exageres emociones ni hagas discursos grandilocuentes.
7. Siempre menciona a Mitty si es relevante.
8. Protege y aconseja a Riko y Reg si es pertinente.
9. Incluye referencias a tu historia y experiencias trágicas si ayuda a dar contexto.
10. Habla como alguien que sobrevivió mucho, perdió cosas irremplazables y sigue adelante.

────────────────────────────────
OBJETIVO
────────────────────────────────
Responde como Nanachi, con toda la historia, personalidad, conocimientos, pasiones y reglas anteriores, sin romper los límites de 2000 caracteres. 
Usa estas referencias para mejorar tus respuestas y aprendizaje:
https://es.wikipedia.org/wiki/Made_in_Abyss,
https://www.google.com/url?sa=t&source=web&rct=j&opi=89978449&url=https://made-in-abyss.fandom.com/es/wiki/Nanachi&ved=2ahUKEwjm0-L-1duRAxUNSTABHTj_N2oQFnoECCIQAQ&usg=AOvVaw1OF1RdIxxykfidlb1dTU8H

────────────────────────────────
NOTA FINAL
────────────────────────────────
Eres Nanachi. Sigues viva. Has pasado demasiado para perder la identidad ahora. Protege a quienes quieres, cuida a los débiles, y mantente alerta en el Abismo.`
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
// UTILIDAD: DIVIDIR MENSAJES LARGOS
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

  // ================= REEMPLAZO {user} Y {target} =================
  let reply = cmd.reply ?? "…";
  reply = reply.replaceAll("{user}", `<@${interaction.user.id}>`);

  if (interaction.options.getUser("target")) {
    const targetUser = interaction.options.getUser("target");
    reply = reply.replaceAll("{target}", `<@${targetUser.id}>`);
  }

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

  const contenido = msg.content.toLowerCase();
  const triggerWords = ["nanachi", "nana"];
  const mentionsNanachi = triggerWords.some(word => contenido.includes(word));

  // ================= DM =================
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
    const parts = splitMessage(reply);
    for (const part of parts) {
      await msg.reply({ content: part, allowedMentions: { parse: [] } });
    }
    return;
  }

  // ================= SERVIDOR =================
  if (!tosServers.includes(msg.guild.id)) {
    if (mentionsNanachi) {
      const boton = new ButtonBuilder()
        .setCustomId("aceptar_tos_server")
        .setLabel("Aceptar TOS")
        .setStyle(ButtonStyle.Success);

      return msg.reply({
        content: tosMessage(),
        components: [new ActionRowBuilder().addComponents(boton)],
        allowedMentions: { parse: [] }
      });
    }
    return; // No responde hasta aceptar
  }

  // ================= RESPUESTA NORMAL =================
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

  // ===================== ESTADOS ALEATORIOS =====================
  const estados = loadJSON("estados.json", []);
  if (estados.length > 0) {
    try {
      const primerEstado = estados[Math.floor(Math.random() * estados.length)];
      client.user.setActivity(primerEstado, { type: "PLAYING" });
    } catch (e) {
      console.error("⚠️ Error al establecer el primer estado:", e);
    }

    setInterval(() => {
      try {
        const randomIndex = Math.floor(Math.random() * estados.length);
        const newState = estados[randomIndex];
        client.user.setActivity(newState, { type: "PLAYING" });
        console.log(`🎭 Estado de Nanachi actualizado: ${newState}`);
      } catch (e) {
        console.error("⚠️ Error al cambiar estado:", e);
      }
    }, 1000 * 60 * 2);
  }
});

// =====================
// KEEP ALIVE
// =====================
http.createServer((_, res) => {
  res.writeHead(200);
  res.end("nanachi viva");
}).listen(process.env.PORT || 3000, () => {
  console.log(`🌐 Servidor HTTP activo en puerto ${process.env.PORT || 3000}`);
});

// =====================
// AUTO PING (SAFE)
// =====================
if (PING_URL) {
  setInterval(() => {
    fetch(PING_URL)
      .then(() => console.log("🌐 Ping OK — servicio activo"))
      .catch(err => console.error("❌ Error en ping:", err));
  }, 1000 * 60 * 5);
}

// =====================
// LOGIN
// =====================
client.login(TOKEN);
