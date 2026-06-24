// =====================
// NANACHI DM CONTROL BOT
// =====================

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events
} from "discord.js";

import http from "http";

// =====================
// ENV
// =====================

const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;

if (!TOKEN) {
  console.error("❌ Falta TOKEN");
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
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// =====================
// MEMORIA DE CANALES
// =====================

// userId -> { channelId, guildId }
const activeChats = new Map();

// =====================
// READY
// =====================

client.once(Events.ClientReady, () => {
  console.log(`✅ Conectada como ${client.user.tag}`);
});

// =====================
// MENSAJES
// =====================

client.on(Events.MessageCreate, async message => {
  try {
    if (message.author.bot) return;

    const isDM = !message.guild;
    const trigger = /\b(nana|nanachi)\b/i;

    // =====================
    // 🔴 MENSAJE A NANACHI
    // =====================

    if (!isDM && trigger.test(message.content)) {

      // Guardar canal para responder luego
      activeChats.set(message.author.id, {
        channelId: message.channel.id,
        guildId: message.guild.id
      });

      try {
        const owner = await client.users.fetch(OWNER_ID);

        await owner.send(
          `📩 MENSAJE PARA NANACHI\n\n` +
          `👤 Usuario: ${message.author.tag}\n` +
          `🆔 ID: ${message.author.id}\n` +
          `💬 Canal: ${message.channel.id}\n\n` +
          `📨 Mensaje:\n${message.content}\n\n` +
          `👉 Responde con: n!write ${message.author.id} tu mensaje`
        );

      } catch (err) {
        console.log("❌ ERROR DM:", err);
      }
    }

    // =====================
    // 🟢 RESPUESTA DESDE DM
    // =====================

    if (isDM && message.author.id === OWNER_ID) {

      if (!message.content.startsWith("n!write")) return;

      const args = message.content.split(" ");

      if (args.length < 3) {
        return message.reply("Uso: n!write userID mensaje");
      }

      const userId = args[1];
      const text = args.slice(2).join(" ");

      const chat = activeChats.get(userId);

      if (!chat) {
        return message.reply("❌ No hay conversación activa con ese usuario");
      }

      try {
        const channel = await client.channels.fetch(chat.channelId);

        if (!channel) {
          return message.reply("❌ Canal no encontrado");
        }

        await channel.send(text);

        message.reply("✅ Respuesta enviada");

      } catch (err) {
        console.log("❌ ERROR RESPONDIENDO:", err);
        message.reply("❌ Error enviando");
      }
    }

  } catch (err) {
    console.log("💥 ERROR:", err);
  }
});

// =====================
// KEEP ALIVE (RENDER)
// =====================

http
  .createServer((req, res) => {
    res.writeHead(200);
    res.end("Nanachi DM activo 🐇");
  })
  .listen(process.env.PORT || 3000);

// =====================
// LOGIN
// =====================

client.login(TOKEN);
