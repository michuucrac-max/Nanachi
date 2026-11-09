
export function evaluateKnowledge(data) {
    if (!data || data.useful !== true) {
        return false;
    }

    if (
        typeof data.topic !== "string" ||
        typeof data.knowledge !== "string" ||
        typeof data.question !== "string" ||
        typeof data.answer !== "string"
    ) {
        return false;
    }

    if (
        data.topic.length < 2 ||
        data.knowledge.length < 20 ||
        data.answer.length < 5
    ) {
        return false;
    }

    if (
        typeof data.confidence !== "number" ||
        data.confidence < 0.8 ||
        data.confidence > 1
    ) {
        return false;
    }

    return true;
}
