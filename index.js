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
  ActivityType,
  PermissionsBitField
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

if (!TOKEN || !CLIENT_ID || !LONGCAT_API) {
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
// BIENVENIDAS / DESPEDIDAS
// =====================
const welcomeData = loadJSON("welcome.json", {});
const saveWelcome = () => saveJSON("welcome.json", welcomeData);

const welcomeMessages = [
  (m, g) => `Riko me ordenó decir esto…\nBienvenido <@${m.id}> a **${g.name}** 🌸`,
  (m) => `Nanachi observa en silencio.\nTen cuidado en este lugar, <@${m.id}>.`,
  (m, g) => `Reg sonríe.\nHey <@${m.id}>, llegaste a **${g.name}**.`,
  (m) => `Faputa inclina la cabeza.\nNo rompas nada, <@${m.id}>.`
];

const goodbyeMessages = [
  (m, g) => `Nanachi baja la mirada…\n${m.user.tag} dejó **${g.name}**.`,
  (m) => `Riko susurra.\nAdiós ${m.user.tag}…`,
  (m) => `Reg observa cómo ${m.user.tag} se aleja.`,
  (m) => `Faputa no sigue a ${m.user.tag}.`
];

// =====================
// ESTADOS ROTATORIOS
// =====================
const estadosRaw = loadJSON("estados.json", []);
const estados = Array.isArray(estadosRaw) ? estadosRaw.filter(e => typeof e === "string") : [];
let estadoIndex = 0;

function rotarEstados() {
  if (!client.user || estados.length === 0) return;
  client.user.setActivity(estados[estadoIndex % estados.length], {
    type: ActivityType.Playing
  });
  estadoIndex++;
}

// =====================
// TEXTO
// =====================
function splitText(text, max = 1900) {
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

// =====================
// TOS
// =====================
const tosUsers = loadJSON("tos.json", []);
const tosServers = loadJSON("tosServers.json", []);

const aceptarTOSUsuario = id => {
  if (!tosUsers.includes(id)) {
    tosUsers.push(id);
    saveJSON("tos.json", tosUsers);
  }
};

const aceptarTOSServidor = id => {
  if (!tosServers.includes(id)) {
    tosServers.push(id);
    saveJSON("tosServers.json", tosServers);
  }
};

const tosMessage = () =>
  "📜 **TÉRMINOS DE SERVICIO — NANACHI**\n" +
  "👉 https://terminosycondicionesdeserv.jimdofree.com/";

// =====================
// LONGCAT PROMPT
// =====================
const NANACHI_PROMPT = `
Eres Nanachi, personaje del manga y anime Made in Abyss.
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
tu maximo de caracterws es de 1500 y tu minimo 100.
no te exedas con las pausas y los ...., si sientes que te vas a exeder pon mejor una accion.
no te exedas.

Eres Nanachi.
Sobreviviste.
Y sigues cuidando.
`;

// =====================
// LONGCAT AI
// =====================
async function longcatAI(content, userId) {
  try {
    const res = await fetch("https://api.longcat.ai/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LONGCAT_API}`
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: NANACHI_PROMPT },
          { role: "user", content }
        ],
        user: userId
      })
    });

    const data = await res.json();

    // Longcat NO siempre responde como OpenAI
    return (
      data?.response ||
      data?.message ||
      data?.content ||
      data?.choices?.[0]?.message?.content ||
      "Nanachi guarda silencio…"
    );

  } catch (err) {
    console.error("❌ Longcat error:", err);
    return "Nanachi no responde ahora.";
  }
}

// =====================
// CMD.JSON + SLASH
// =====================
const slashData = [];

if (fs.existsSync("cmd.json")) {
  const cmds = JSON.parse(fs.readFileSync("cmd.json", "utf8"));
  for (const cmd of cmds) {
    client.commands.set(cmd.name, cmd);
    slashData.push({
      name: cmd.name,
      description: cmd.description ?? "Nanachi responde.",
      options: [{
        name: "target",
        description: "Usuario objetivo",
        type: 6,
        required: false
      }]
    });
  }
}

slashData.push({
  name: "setwelcome",
  description: "Configura el canal de bienvenidas",
  options: [{
    name: "channel",
    description: "Canal",
    type: 7,
    required: true
  }]
});

// =====================
// READY
// =====================
client.once(Events.ClientReady, async () => {
  console.log(`✅ Nanachi conectada como ${client.user.tag}`);
  client.user.setActivity("Observando el Abismo…", { type: ActivityType.Playing });
  if (estados.length) setInterval(rotarEstados, 120000);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashData });
});

// =====================
// BIENVENIDAS
// =====================
client.on(Events.GuildMemberAdd, m => {
  const cfg = welcomeData[m.guild.id];
  if (!cfg) return;
  const ch = m.guild.channels.cache.get(cfg.channel);
  if (!ch) return;
  ch.send(welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)](m, m.guild));
});

client.on(Events.GuildMemberRemove, m => {
  const cfg = welcomeData[m.guild.id];
  if (!cfg) return;
  const ch = m.guild.channels.cache.get(cfg.channel);
  if (!ch) return;
  ch.send(goodbyeMessages[Math.floor(Math.random() * goodbyeMessages.length)](m, m.guild));
});

// =====================
// INTERACTIONS
// =====================
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton()) {
    await interaction.deferReply({ ephemeral: true });
    if (interaction.customId === "accept_tos_user") {
      aceptarTOSUsuario(interaction.user.id);
      return interaction.editReply("✅ TOS aceptados.");
    }
    if (interaction.customId === "accept_tos_server") {
      aceptarTOSServidor(interaction.guild.id);
      return interaction.editReply("✅ TOS del servidor aceptados.");
    }
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "setwelcome") {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply({ content: "Nanachi niega con la cabeza.", ephemeral: true });

    const ch = interaction.options.getChannel("channel");
    welcomeData[interaction.guild.id] = { channel: ch.id };
    saveWelcome();
    return interaction.reply(`Canal configurado: ${ch}`);
  }

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  const target = interaction.options.getUser("target") ?? interaction.user;
  const random = Math.floor(Math.random() * 101);
  const lovemessage = [
    "Nanachi se sonroja 🐾",
    "El Abismo observa",
    "Nanachi aparta la mirada",
    "Algo cálido se siente"
  ][Math.floor(Math.random() * 4)];

  const reply = cmd.reply
    .replace(/{user}/g, `<@${interaction.user.id}>`)
    .replace(/{target}/g, `<@${target.id}>`)
    .replace(/{random}/g, random)
    .replace(/{lovemessage}/g, lovemessage);

  interaction.reply({ content: reply });
});

// =====================
// MESSAGE CREATE — LONGCAT
// =====================
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;
  const call = /\b(nana|nanachi)\b/i;
  if (!msg.guild && !tosUsers.includes(msg.author.id)) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept_tos_user")
        .setLabel("Aceptar TOS")
        .setStyle(ButtonStyle.Success)
    );
    return msg.reply({ content: tosMessage(), components: [row] });
  }

  if (msg.guild && !call.test(msg.content)) return;
  if (msg.guild && !tosServers.includes(msg.guild.id)) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept_tos_server")
        .setLabel("Aceptar TOS del servidor")
        .setStyle(ButtonStyle.Success)
    );
    return msg.reply({ content: tosMessage(), components: [row] });
  }

  await msg.channel.sendTyping();
  const reply = await longcatAI(msg.content, msg.author.id);
  for (const p of splitText(reply)) await msg.reply(p);
});

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
