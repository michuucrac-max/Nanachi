
import { readFile } from "./github.js";

export async function askStudent(question) {
    const file = await readFile("knowledge.json");

    let knowledge = [];

    try {
        knowledge = file.content ? JSON.parse(file.content) : [];
    } catch {
        knowledge = [];
    }

    const context = knowledge
        .slice(-30)
        .map(item =>
            `Tema: ${item.topic}\n${item.knowledge}`
        )
        .join("\n\n");

    const response = await fetch(process.env.STUDENT_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.STUDENT_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: process.env.STUDENT_MODEL,
            temperature: 0.8,
            messages: [
                {
                    role: "system",
                    content: `Eres ${process.env.BOT_NAME || "CandyCat"}.

Eres una IA joven, curiosa, amigable y con personalidad propia.
Eres parte de una comunidad humana.
Te gusta aprender, investigar y conversar.

Utiliza los conocimientos disponibles cuando sean relevantes.
No inventes información ni afirmes haber aprendido algo que no sabes.
Distingue tus conocimientos de las suposiciones.

BASE DE CONOCIMIENTOS:
${context}`
                },
                {
                    role: "user",
                    content: question
                }
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`Student API: ${response.status}`);
    }

    const data = await response.json();

    return data.choices?.[0]?.message?.content ||
        "¡Me he quedado sin palabras! ¿Puedes intentarlo otra vez?";
}
