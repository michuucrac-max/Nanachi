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
// MEMORIA PERSISTENTE (AGREGADO)
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
// MENSAJES DE AMOR (AGREGADO)
// =====================
const loveMessages = [
"Nanachi sonríe con timidez 💞",
"El Abismo aprueba este vínculo 💫",
"Nanachi siente calorcito en el pecho 🐾",
"Algo bonito nació aquí ✨",
"Nanachi ronronea bajito 😽"
];

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
// (NO TOCADO)
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
...
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

} catch (e) {
console.error("⚠️ Error LongCat AI:", e);
return "…perdón, mi cabeza dio vueltas un momento.";
}
}

// =====================
// INTERACCIONES SLASH (EXTENDIDO)
// =====================
client.on(Events.InteractionCreate, async interaction => {

if (!interaction.isChatInputCommand()) return;

const cmd = client.commands.get(interaction.commandName);
if (!cmd) return;

let reply = cmd.reply ?? "…";
reply = reply.replaceAll("{user}", `<@${interaction.user.id}>`);

const targetUser = interaction.options.getUser("target");
if (targetUser) {
reply = reply.replaceAll("{target}", `<@${targetUser.id}>`);
}

// Love calculator
if (reply.includes("{random}")) {
const percent = Math.floor(Math.random() * 101);
reply = reply.replaceAll("{random}", percent.toString());
const msg = loveMessages[Math.floor(Math.random() * loveMessages.length)];
reply = reply.replaceAll("{loveMessage}", msg);
}

// Stats
const statMap = {
nanahug: "abrazos",
nanakiss: "besos",
nanacuddle: "acurrucos",
nanapatpat: "patpats"
};

if (statMap[interaction.commandName] && targetUser) {
const total = addStat(statMap[interaction.commandName], targetUser.id);
reply += `\n🐾 Nanachi ya recibió **${total}** ${statMap[interaction.commandName]} 💙`;
}

// Adopción
if (interaction.commandName === "nanaadopt" && targetUser) {
adoptData[targetUser.id] = interaction.user.id;
saveAdopt();
reply = `🐾 ${interaction.user} ha adoptado a ${targetUser}~\nNanachi observa en silencio 💞`;
}

interaction.reply({
content: reply,
allowedMentions: { users: [] }
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
// WEB SERVICE
// =====================
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
res.writeHead(200, { "Content-Type": "text/plain" });
res.end("Nanachi observa el Abismo…\n");
}).listen(PORT);

// =====================
// LOGIN
// =====================
client.login(TOKEN);
