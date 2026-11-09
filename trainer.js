
import { appendJSONL } from "./github.js";

export async function saveHumanLearning(entry) {
    return appendJSONL("human_training.jsonl", {
        type: "human_knowledge",
        question: entry.question,
        answer: entry.answer,
        topic: entry.topic,
        date: new Date().toISOString()
    });
}

export async function saveAILearning(entry) {
    return appendJSONL("ai_training.jsonl", {
        type: "teacher_generated",
        question: entry.question,
        answer: entry.answer,
        topic: entry.topic,
        date: new Date().toISOString()
    });
}
