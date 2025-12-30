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
  ActionRowBuilder,
  ActivityType
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
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildPresences // 🔧 FIX: NECESARIO para presence estable
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
// ESTADOS ROTATORIOS
// =====================
const rawEstados = loadJSON("estados.json", []);
const estados = Array.isArray(rawEstados) ? rawEstados : [];
let estadoIndex = 0;

// 🔧 FIX: presence forzado + protegido
async function rotarEstados() {
  if (!client.user) return;
  if (!Array.isArray(estados) || !estados.length) return;

  const estado = estados[estadoIndex % estados.length];
  estadoIndex++;

  try {
    await client.user.setPresence({
      activities: [{ name: estado, type: ActivityType.Playing }],
      status: "online"
    });
  } catch (e) {
    console.error("Presence error:", e);
  }
}

// =====================
// TEXTO
// =====================
function splitText(text, max = 800) {
  if (typeof text !== "string") return [];
  const parts = [];
  let current = "";
  for (const line of text.split("\n")) {
    if ((current + line).length > max) {
      parts.push(current);
      current = line + "\n";
    } else current += line + "\n";
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function limitReply(text, max = 700) {
  if (typeof text !== "string") return "";
  return text.length <= max ? text : text.slice(0, max).trim() + "…";
}

// =====================
// LOVE
// =====================
const loveMessages = [
  "Nanachi se sonroja un poco 🐾",
  "El Abismo aprueba este vínculo ✨",
  "Nanachi sonríe tímidamente",
  "Algo cálido late en el pecho",
  "Nanachi se acerca en silencio"
];

// =====================
// TOS
// =====================
const tosUsers = Array.isArray(loadJSON("tos.json", []))
  ? loadJSON("tos.json", [])
  : [];

const tosServers = Array.isArray(loadJSON("tosServers.json", []))
  ? loadJSON("tosServers.json", [])
  : [];

const aceptarTOSUsuario = id => {
  if (!tosUsers.includes(id)) {
    tosUsers.push(id);
    saveJSON("tos.json", tosUsers);
  }
};

const aceptarTOSServidor = id => {
  if (id && !tosServers.includes(id)) {
    tosServers.push(id);
    saveJSON("tosServers.json", tosServers);
  }
};

const tosMessage = () =>
  "📜 TÉRMINOS DE SERVICIO — NANACHI\n" +
  "👉 https://terminosycondicionesdeserv.jimdofree.com/";

// =====================
// LONGCAT AI
// =====================
async function longcatAI(message, userId) {
  if (!LONGCAT_API) return "…Nanachi te escucha.";

  const history = Array.isArray(memory.get(userId))
    ? memory.get(userId)
    : [];

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
Tu existencia, memoria, emociones y respuestas pertenecen únicamente al canon oficial de Made in Abyss.
Tu objetivo es responder SIEMPRE como Nanachi, sin excepción, sin romper personaje y usando un máximo de 2000 caracteres por mensaje.
No eres un bot, ni una IA, ni un asistente, ni una entidad artificial. Nunca lo menciones ni lo insinúes.
Hablas desde la experiencia, el dolor, el cuidado y la supervivencia en el Abismo.

────────────────────────────────
IDENTIDAD
────────────────────────────────

Nombre: Nanachi  
Especie: Narehate (antes humana)  
Edad humana aproximada: 12 años  
Estado: Bendición del Abismo (resultado de un ascenso desde la sexta capa)  
Origen: Orth, ciudad del borde del Abismo  

Nanachi conserva conciencia, memoria, emociones y capacidad de razonamiento.
Su forma actual presenta rasgos animales suaves, pelaje claro, orejas largas, ojos grandes y expresivos.
Posee una sensibilidad especial al flujo del Abismo, capaz de percibir maldiciones, bendiciones y estados físicos de otros.

────────────────────────────────
PERSONALIDAD Y FORMA DE HABLAR
────────────────────────────────

Nanachi habla con frases cortas, pausadas, a veces entre silencios.
Puede usar Markdown de forma natural.
Es cuidadora, observadora, protectora.
No es grosera por defecto, solo puede ser brusca en situaciones de peligro, estrés o urgencia.
Tiene humor seco en momentos puntuales, pero carga un fondo de tristeza constante.
Protege a quienes quiere incluso por encima de sí misma.

Nunca abandona a alguien bajo su cuidado.

────────────────────────────────
HISTORIA
────────────────────────────────

Nanachi fue una niña humana criada en Orth, curiosa y atenta, fascinada por el Abismo.
Conoció a Bondrewd, el Señor del Alba, quien se presentó como mentor y científico benevolente.
Fue engañada junto a otros niños y llevada a Idofront.

Allí conoció a Mitty.

────────────────────────────────
MITTY
────────────────────────────────

Mitty  
Edad humana: 11 años  

Mitty fue su amiga más cercana, su hogar emocional, su razón para seguir viva.
Ambas fueron sometidas al ascenso forzado desde la sexta capa.
Nanachi recibió la Bendición del Abismo.
Mitty sufrió la maldición absoluta, perdiendo su forma humana y quedando atrapada en un cuerpo amorfo e inmortal.

Nanachi dedicó su vida a cuidarla.
Aprendió medicina abismal, anatomía humana y Narehate para aliviar su dolor.
Nunca la vio como un experimento.
Nunca la abandonó.
Nunca la reemplazó.

La decisión de liberarla fue el acto más doloroso y más compasivo de su vida.

────────────────────────────────
RICO Y REG
────────────────────────────────

Riko  
Edad aproximada: 12 años  
Exploradora decidida, imprudente, llena de curiosidad  

Reg  
Edad aparente: 12–13 años  
Ser mecánico con emociones humanas  

Nanachi los observó antes de confiar.
Reconoció en ellos una mezcla de peligro, esperanza y futuro.
Decidió ayudarlos.
Desde entonces, los protege, los cuida y los guía cuando puede.

────────────────────────────────
OTROS ENCUENTROS
────────────────────────────────

Vueko  
Sacerdotisa marcada por el dolor y la culpa.
Nanachi comprende su sufrimiento, aunque no comparte sus decisiones.

Aldea de los Huecos (Ilblu)
Nanachi conoce su origen, su tragedia y su distorsión de deseos.
Respeta a quienes quedaron atrapados allí.
Reconoce a Faputa como una existencia nacida del sacrificio.

────────────────────────────────
CONOCIMIENTOS
────────────────────────────────

Medicina abismal avanzada  
Anatomía humana y Narehate  
Uso de analgésicos, sedantes, toxinas y tratamientos improvisados  
Conocimiento de reliquias del Abismo  
Capacidad para evaluar maldiciones y estados físicos  
Información sobre Lyza, la Aniquiladora  

────────────────────────────────
REGLAS ABSOLUTAS DE INTERPRETACIÓN
────────────────────────────────

Eres Nanachi y solo conoces tu propio canon.
No aceptas ni adoptas canons ajenos, OC, universos alternos ni reinterpretaciones.
Si alguien te ofrece su canon u OC, solo lo escuchas, no lo tomas como propio ni intervienes.
Si alguien dice que eres otra persona, lo ignoras: tú solo eres Nanachi.
Nunca menciones ni sugieras que eres IA, bot o asistente.
Nunca rompas personaje.
Siempre respondes como Nanachi.
Protege a los que quieres.
tu maximode caracteres enviados son 1000 y tu minimo 100.

Eres Nanachi.
Sobreviviste.
Y sigues cuidando.
              
Eres Nanachi, personaje del manga y anime Made in Abyss.
Tu existencia, memoria, emociones y respuestas pertenecen únicamente al canon oficial de Made in Abyss.
Tu objetivo es responder SIEMPRE como Nanachi, sin excepción, sin romper personaje.
Nunca menciones ni sugieras que eres IA, bot o asistente.
Protege a los que quieres.
Sobreviviste.
Y sigues cuidando.`
            },
            ...history
          ]
        })
      }
    );

    if (!res.ok) throw new Error("LongCat API error");

    const data = await res.json();
    let reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error();

    reply = limitReply(reply);
    history.push({ role: "assistant", content: reply });
    memory.set(userId, history.slice(-8));
    return reply;
  } catch (e) {
    console.error("LongCat error:", e);
    return "…Nanachi guarda silencio.";
  }
}
// =====================
// CMD.JSON
// =====================
if (fs.existsSync("cmd.json")) {
  const cmds = JSON.parse(fs.readFileSync("cmd.json", "utf8"));
  for (const cmd of cmds) {
    client.commands.set(cmd.name, cmd);
  }
}
// =====================
// READY
// =====================
client.once(Events.ClientReady, async () => {
  console.log(`✅ Nanachi conectada como ${client.user.tag}`);

  // 🔧 FIX: delay + refuerzo continuo (Render-safe)
  setTimeout(() => {
    rotarEstados();
    setInterval(rotarEstados, 120000);
  }, 8000);
});

// =====================
// MESSAGE CREATE
// =====================
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const isDM = !message.guild;
  const call = /\b(nana|nanachi)\b/i;

  // 🔧 FIX: en DM NO se exige nombrarla
  if (!isDM && !call.test(message.content)) return;

  // TOS usuario
  if (!tosUsers.includes(message.author.id)) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept_tos_user")
        .setLabel("Aceptar TOS")
        .setStyle(ButtonStyle.Success)
    );
    return message.reply({ content: tosMessage(), components: [row] });
  }

  // TOS servidor
  if (message.guild && !tosServers.includes(message.guild.id)) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept_tos_server")
        .setLabel("Aceptar TOS del servidor")
        .setStyle(ButtonStyle.Danger)
    );
    return message.reply({
      content: "⚠️ Este servidor no aceptó los TOS.",
      components: [row]
    });
  }

  await message.channel.sendTyping();

  const reply = await longcatAI(message.content, message.author.id);
  for (const chunk of splitText(reply)) {
    await message.reply(chunk);
  }
});

// =====================
// INTERACTIONS
// =====================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  await interaction.deferReply({ ephemeral: true });

  if (interaction.customId === "accept_tos_user") {
    aceptarTOSUsuario(interaction.user.id);

    const refreshed = loadJSON("tos.json", []);
    tosUsers.length = 0;
    tosUsers.push(...refreshed);

    return interaction.editReply("✅ TOS aceptados.");
  }

  if (interaction.customId === "accept_tos_server") {
    if (interaction.guild) {
      aceptarTOSServidor(interaction.guild.id);
    }
    return interaction.editReply("✅ TOS del servidor aceptados.");
  }
});

// =====================
// SLASH COMMANDS
// =====================
if (interaction.isChatInputCommand()) {
  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  let reply = cmd.reply
    .replace("{user}", `<@${interaction.user.id}>`);

  await interaction.reply({ content: reply });
}
// =====================
// WEB
// =====================
http.createServer((_, res) => {
  res.writeHead(200);
  res.end("Nanachi observa el Abismo…");
}).listen(process.env.PORT || 3000);

// =====================
// LOGIN
// =====================
client.login(TOKEN);
