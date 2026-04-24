console.log("🚨 INICIANDO PROCESO...");

import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import {
  Client,
  GatewayIntentBits,
  Events
} from "discord.js";

import http from "http";

// ===== DEBUG GLOBAL =====
process.on("unhandledRejection", err => {
  console.error("❌ UNHANDLED:", err);
});

process.on("uncaughtException", err => {
  console.error("❌ EXCEPTION:", err);
});

// ===== ENV =====
const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;

console.log("🔎 TOKEN:", TOKEN ? "OK" : "NO");

if (!TOKEN) {
  console.error("❌ SIN TOKEN");
  process.exit(1);
}

// ===== CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔥 DEBUG INTERNO DISCORD
client.on("debug", msg => console.log("📡 DEBUG:", msg));
client.on("error", err => console.error("❌ CLIENT ERROR:", err));
client.on("shardError", err => console.error("❌ SHARD ERROR:", err));

// ===== READY =====
client.once(Events.ClientReady, () => {
  console.log("✅ CONECTADO COMO:", client.user.tag);
});

// ===== MENSAJES =====
client.on(Events.MessageCreate, msg => {
  if (msg.author.bot) return;
  msg.reply("…Estoy viva.");
});

// ===== SERVER =====
http.createServer((_, res) => {
  res.end("OK");
}).listen(PORT, () => {
  console.log("🌐 WEB OK");
});

// ===== LOGIN =====
console.log("🔵 LOGIN...");

client.login(TOKEN)
  .then(() => console.log("🟢 LOGIN OK"))
  .catch(err => console.error("🔴 LOGIN ERROR:", err));
