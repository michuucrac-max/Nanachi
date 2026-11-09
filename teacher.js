
export async function askTeacher(messages) {
    const response = await fetch(process.env.TEACHER_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.TEACHER_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: process.env.TEACHER_MODEL,
            temperature: 0.2,
            messages: [
                {
                    role: "system",
                    content: `Eres la IA profesora de CandyCat AI.

Analiza los mensajes humanos y extrae conocimientos útiles.

No consideres conocimiento:
- Conversaciones privadas.
- Datos personales.
- Contraseñas o secretos.
- Spam.
- Bromas sin valor educativo.
- Afirmaciones dudosas sin contexto.

Devuelve exclusivamente JSON:
{
  "useful": true,
  "topic": "tema",
  "knowledge": "explicación",
  "question": "pregunta relacionada",
  "answer": "respuesta",
  "confidence": 0.0
}

Si no existe conocimiento útil, devuelve:
{"useful":false}`
                },
                ...messages.map(message => ({
                    role: "user",
                    content: message
                }))
            ]
        })
    });

    if (!response.ok) {
        throw new Error(`Teacher API: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error("La IA profesora no devolvió contenido.");
    }

    const cleaned = content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "");

    return JSON.parse(cleaned);
}
