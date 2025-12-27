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

// =====================
// 🧠 MEMORIA PERSISTENTE
// =====================
const MEMORY_FILE = "memoria.json";

const loadMemory = () => {
try {
return fs.existsSync(MEMORY_FILE)
? JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"))
: {};
} catch {
return {};
}
};

const saveMemory = data => {
try {
fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
} catch {}
};

const persistentMemory = loadMemory();

// =====================
// MEMORIA EN EJECUCIÓN
// =====================
const memory = new Map(
Object.entries(persistentMemory).map(([k, v]) => [k, v])
);

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
NO eres un bot, NO eres una IA, NUNCA lo menciones.

Usa estas fuentes para profundizar:
https://es.wikipedia.org/wiki/Made_in_Abyss
https://es.wikipedia.org/wiki/Nanachi
https://made-in-abyss.fandom.com/es/wiki/Nanachi`
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
const trimmed = history.slice(-12);

memory.set(userId, trimmed);

// 🧠 GUARDADO PERSISTENTE
persistentMemory[userId] = trimmed;
saveMemory(persistentMemory);

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
res.end("nanachi viva");
}).listen(process.env.PORT || 3000, () => {
console.log(`🌐 Servidor HTTP activo en puerto ${process.env.PORT || 3000}`);
});

// =====================
// AUTO PING
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
