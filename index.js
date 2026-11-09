import { createDiscordClient } from "./discord.js";
import { startLearning } from "./collector.js";

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

client.login(process.env.DISCORD_TOKEN);
