
export function processKnowledge(data, author) {
    return {
        id: crypto.randomUUID(),
        topic: data.topic,
        knowledge: data.knowledge,
        question: data.question,
        answer: data.answer,
        confidence: data.confidence,
        contributor: author,
        verified: false,
        created_at: new Date().toISOString()
    };
}
