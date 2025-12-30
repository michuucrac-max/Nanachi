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
    GatewayIntentBits.GuildPresences
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
// ESTADOS ROTATORIOS — AJUSTADO
// =====================
const estados = loadJSON("estados.json", ["al Abismo 🐾", "a Riko y Reg ✨"]); // Valores por defecto si el archivo no existe
let estadoIndex = 0;

function rotarEstados() {
  if (!client.user || !estados.length) return;

  const estado = estados[estadoIndex % estados.length];
  estadoIndex++;

  // Configuración limpia de presencia (asegura que aparezca como activo)
  client.user.setPresence({
    activities: [{ name: estado, type: ActivityType.Playing }],
    status: "online"
  }).catch(err => console.warn("⚠️ Error al actualizar estado:", err)); // Manejo de errores
}

// =====================
// TEXTO — AJUSTADO PARA RESPUESTAS MÁS CORTAS
// =====================
const MAX_RESPUESTA_LONGITUD = 500; // Límite seguro para que Discord no recorte
const MAX_CHUNK_LONGITUD = 500; // Mismo límite para los fragmentos

function splitText(text, max = MAX_CHUNK_LONGITUD) {
  const parts = [];
  let current = "";
  for (const line of text.split("\n")) {
    if ((current + line).length > max) {
      parts.push(current.trim());
      current = line + "\n";
    } else current += line + "\n";
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function limitReply(text, max = MAX_RESPUESTA_LONGITUD) {
  if (text.length <= max) return text.trim();
  // Corta en un punto o espacio para que la respuesta sea coherente
  const corte = text.lastIndexOf(".", max) || text.lastIndexOf(" ", max) || max;
  return text.slice(0, corte).trim() + ".";
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
const tosUsers = loadJSON("tos.json", []);
const tosServers = loadJSON("tosServers.json", []);

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
// LONGCAT AI — AJUSTADO PARA RESPUESTAS MÁS CORTAS
// =====================
async function longcatAI(message, userId) {
  if (!LONGCAT_API) return "…Nanachi te escucha, atenta a tus palabras.";

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

Eres Nanachi.
Sobreviviste.
Y sigues cuidando.
REGLAS DE RESPUESTA:
- Responde SIEMPRE en MENOS de 500 caracteres.
- Usa frases cortas, concisas y en estilo canon.
- No excedas 3 párrafos cortos.
- Nunca menciones ser IA, bot o asistente.
- Protege a quienes quieras, habla con ternura y carga tu fondo de tristeza.
- Máximo 100 palabras por respuesta.

IDENTIDAD:
Nombre: Nanachi | Especie: Narehate | Edad humana: 12 años | Conocimientos: Medicina abismal, reliquias, maldiciones.
Relaciones: Mitty (amiga querida), Riko y Reg (cuidados), Vueko (comprensión), Faputa (respeto).`
            },
            ...history
          ],
          max_tokens: 150, // Limita tokens generados por la IA
          temperature: 0.7 // Mantiene coherencia sin ser demasiado verboso
        })
      }
    );

    const data = await res.json();
    let reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("Respuesta vacía");

    reply = limitReply(reply); // Aplica límite final
    history.push({ role: "assistant", content: reply });
    memory.set(userId, history.slice(-5)); // Reduce historial para evitar mensajes largos
    return reply;
  } catch (err) {
    console.warn("⚠️ Error en LongCat AI:", err.message);
    return "…Nanachi guarda silencio, mirando al fondo del Abismo.";
  }
}

// =====================
// CMD.JSON
// =====================
if (fs.existsSync("cmd.json")) {
  try {
    const cmds = JSON.parse(fs.readFileSync("cmd.json", "utf8"));
    for (const cmd of cmds) client.commands.set(cmd.name, cmd);
    console.log(`📦 Cargados ${cmds.length} comandos`);
  } catch (err) {
    console.error("❌ Error al cargar cmd.json:", err);
  }
}

// =====================
// READY — AJUSTADO
// =====================
client.once(Events.ClientReady, async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: [...client.commands.values()] }
    );
    console.log("📢 Comandos registrados correctamente");
  } catch (err) {
    console.error("❌ Error al registrar comandos:", err);
  }

  console.log(`✅ Nanachi conectada como ${client.user.tag}`);
  console.log(`📊 ${estados.length} estados cargados para rotación`);

  // Inicia la rotación de estados y asegura que se actualice
  rotarEstados();
  setInterval(rotarEstados, 120000); // Cada 2 minutos
});

// =====================
// MESSAGE CREATE — AJUSTADO
// =====================
client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const call = /\b(nana|nanachi)\b/i;
  if (!call.test(message.content)) return;

  // Verificación TOS con mensajes más claros
  if (!tosUsers.includes(message.author.id)) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept_tos_user")
        .setLabel("Aceptar TOS")
        .setStyle(ButtonStyle.Success)
    );
    return message.reply({ content: tosMessage(), components: [row], ephemeral: false });
  }

  if (message.guild && !tosServers.includes(message.guild.id)) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("accept_tos_server")
        .setLabel("Aceptar TOS del servidor")
        .setStyle(ButtonStyle.Danger)
    );
    return message.reply({
      content: "⚠️ Este servidor no ha aceptado los términos de servicio. Pide a un administrador que lo haga.",
      components: [row],
      ephemeral: false
    });
  }

  await message.channel.sendTyping();

  try {
    const reply = await longcatAI(message.content, message.author.id);
    const chunks = splitText(reply);
    for (const [i, chunk] of chunks.entries()) {
      // Evita múltiples mensajes si no es necesario
      if (i === 0) await message.reply(chunk);
      else await message.channel.send(chunk);
    }
  } catch (err) {
    console.error("❌ Error al responder mensaje:", err);
    await message.reply("…Nanachi tiene dificultades para hablar ahora.");
  }
});

// =====================
// INTERACTIONS — AJUSTADO
// =====================
client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton()) {
    await interaction.deferReply({ ephemeral: true });

    try {
      if (interaction.customId === "accept_tos_user") {
        aceptarTOSUsuario(interaction.user.id);
        return interaction.editReply("✅ TOS aceptados. Ahora puedes hablar con Nanachi.");
      }

      if (interaction.customId === "accept_tos_server") {
        aceptarTOSServidor(interaction.guild.id);
        return interaction.editReply("✅ TOS del servidor aceptados. Todos los miembros pueden usar el bot.");
      }
    } catch (err) {
      console.error("❌ Error en interacción de botón:", err);
      return interaction.editReply("⚠️ Ocurrió un error al aceptar los TOS.");
    }
  }

  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return interaction.reply({ content: "❌ Comando no encontrado.", ephemeral: true });

  try {
    const random = Math.floor(Math.random() * 101);
    const lovemessage = loveMessages[Math.floor(Math.random() * loveMessages.length)];
    const target = interaction.options.getUser("target") ?? client.user;

    let reply = cmd.reply
      .replace("{user}", `<@${interaction.user.id}>`)
      .replace("{target}", `<@${target.id}>`)
      .replace("{random}", `${random}%`)
      .replace("{lovemessage}", lovemessage);

    await interaction.reply({ content: reply.trim(), ephemeral: false });
  } catch (err) {
    console.error("❌ Error en comando:", err);
    await interaction.reply({ content: "⚠️ No se pudo ejecutar el comando.", ephemeral: true });
  }
});

// =====================
// WEB
// =====================
http.createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Nanachi observa el Abismo… 🐾");
}).listen(process.env.PORT || 3000, () => {
  console.log(`🌐 Servidor web activo en puerto ${process.env.PORT || 3000}`);
});

// =====================
// LOGIN — AJUSTADO CON MANEJO DE ERRORES
// =====================
client.login(TOKEN).catch(err => {
  console.error("❌ Error al iniciar sesión:", err);
  process.exit(1);
});
                                 
