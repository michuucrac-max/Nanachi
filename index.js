
import { createServer } from "node:http";

import { createDiscordClient } from "./discord.js";
import { startLearning } from "./collector.js";

// ========================================
// NANACHI KEEP ALIVE
// ========================================

const PORT = process.env.PORT || 3000;

const server = createServer((req, res) => {

    if (req.method === "GET" && req.url === "/") {

        res.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store"
        });

        return res.end("Nanachi está despierta.");

    }

    res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Ruta no encontrada.");

});

server.listen(PORT, "0.0.0.0", () => {

    console.log("--------------------------------");
    console.log("NANACHI KEEP ALIVE");
    console.log("--------------------------------");
    console.log(`Servidor activo en puerto ${PORT}`);
    console.log("Ruta de comprobación: /");
    console.log("--------------------------------");

});

// ========================================
// DISCORD BOT
// ========================================

const client = createDiscordClient();

client.once("ready", async () => {

    console.log(`CandyCat AI conectado como ${client.user.tag}`);

    const guild = client.guilds.cache.get(process.env.GUILD_ID);

    if (!guild) {

        console.error("No se encontró el servidor autorizado.");

        process.exit(1);

    }

    console.log(`Servidor autorizado: ${guild.name}`);

    startLearning(client);

});

// ========================================
// INICIAR NANACHI
// ========================================

client.login(process.env.DISCORD_TOKEN).catch(error => {

    console.error("Error al conectar Nanachi:", error);

});
