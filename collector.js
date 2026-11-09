
import { askTeacher } from "./teacher.js";
import { askStudent } from "./student.js";
import { evaluateKnowledge } from "./evaluator.js";
import { processKnowledge } from "./processor.js";
import { appendKnowledge } from "./github.js";
import {
    saveHumanLearning,
    saveAILearning
} from "./trainer.js";

const recentMessages = new Map();

export function startLearning(client) {
    client.on("messageCreate", async message => {
        try {
            if (message.author.bot) return;
            if (!message.guild) return;
            if (message.guild.id !== process.env.GUILD_ID) return;

            const text = message.content.trim();

            if (!text || text.length < 25) return;

            // No recopilar comandos ni mensajes con secretos obvios.
            if (/^\s*[!/]/.test(text)) return;
            if (/password|contraseña|token secreto/i.test(text)) return;

            // Conversación con la IA cuando la mencionan.
            const mentioned = message.mentions.has(client.user);

            if (mentioned) {
                const question = text
                    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
                    .trim();

                const answer = await askStudent(question);

                await message.reply({
                    content: answer.slice(0, 1900),
                    allowedMentions: {
                        repliedUser: false
                    }
                });
            }

            // Evitar procesar mensajes repetidos.
            if (recentMessages.has(message.id)) return;
            recentMessages.set(message.id, true);

            if (recentMessages.size > 500) {
                recentMessages.clear();
            }

            // La IA profesora analiza el conocimiento humano.
            const result = await askTeacher([text]);

            if (!evaluateKnowledge(result)) return;

            const entry = processKnowledge(
                result,
                message.author.username
            );

            // GitHub: biblioteca de conocimientos.
            await appendKnowledge(entry);

            // Datasets separados por procedencia.
            await saveHumanLearning(entry);

            await saveAILearning({
                question: result.question,
                answer: result.answer,
                topic: result.topic
            });

            console.log(
                `Nuevo conocimiento: ${entry.topic}`
            );

        } catch (error) {
            console.error("Error de aprendizaje:", error.message);
        }
    });

    console.log("Sistema de aprendizaje activado.");
}
